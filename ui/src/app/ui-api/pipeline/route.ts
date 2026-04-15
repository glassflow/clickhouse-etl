import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'
import { structuredLogger } from '@/src/observability'
import { ClickhouseService } from '@/src/services/clickhouse-service'
import type { ClickHouseConfig } from '../clickhouse/clickhouse-utils'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

/**
 * Get table mapping for create-table flow.
 * V1/Internal: sink.table_mapping (array with column_name, column_type)
 * V2: sink.table_mapping is deleted; mapping is in schema.fields (each field has column_name, column_type when mapped)
 * V3/OTLP: sink.mapping (array with name=eventField, column_name, column_type)
 */
function getMappedColumns(config: {
  sink?: Record<string, unknown>
  schema?: { fields?: Array<{ column_name?: string; column_type?: string }> }
}): Array<{ name: string; type: string }> {
  const sink = config?.sink as Record<string, unknown> | undefined

  // V1 format: sink.table_mapping
  const tableMapping = (sink?.table_mapping ?? []) as Array<{ column_name?: string; column_type?: string }>
  if (Array.isArray(tableMapping) && tableMapping.length > 0) {
    const cols = tableMapping
      .filter((m) => m?.column_name && m?.column_type)
      .map((m) => ({ name: String(m.column_name), type: String(m.column_type) }))
    if (cols.length > 0) return cols
  }

  // V3/OTLP format: sink.mapping (column_name is the ClickHouse column name)
  const v3Mapping = (sink?.mapping ?? []) as Array<{ column_name?: string; column_type?: string }>
  if (Array.isArray(v3Mapping) && v3Mapping.length > 0) {
    const cols = v3Mapping
      .filter((m) => m?.column_name && m?.column_type)
      .map((m) => ({ name: String(m.column_name), type: String(m.column_type) }))
    if (cols.length > 0) return cols
  }

  // V2 format: schema.fields with column_name/column_type
  const fields = (config?.schema?.fields ?? []) as Array<{ column_name?: string; column_type?: string }>
  return fields
    .filter((f) => f?.column_name && f?.column_type)
    .map((f) => ({ name: String(f.column_name), type: String(f.column_type) }))
}

/** Detect "create new table" flow: sink has engine, order_by, database, table, and at least one mapped column */
function isCreateNewTableFlow(config: {
  sink?: Record<string, unknown>
  schema?: { fields?: Array<{ column_name?: string; column_type?: string }> }
}): boolean {
  const sink = config?.sink
  if (!sink || typeof sink !== 'object') return false
  if (!sink.engine || !sink.order_by) return false
  const columns = getMappedColumns(config)
  if (columns.length === 0) return false
  // V3/OTLP format puts database inside connection_params; flat formats put it on sink directly
  const cp = (sink.connection_params as Record<string, unknown> | undefined) ?? {}
  const database = sink.database ?? cp.database
  return !!database && !!sink.table
}

/** Build ClickHouse config and create-table params from pipeline config */
function buildCreateTableParams(config: {
  sink?: Record<string, unknown>
  schema?: { fields?: Array<{ column_name?: string; column_type?: string }> }
}): {
  chConfig: ClickHouseConfig
  params: { database: string; table: string; engine: string; orderBy: string; columns: Array<{ name: string; type: string }> }
} | null {
  const sink = config?.sink as Record<string, unknown> | undefined
  if (!sink) return null
  const columns = getMappedColumns(config)
  if (columns.length === 0) return null
  // Support both flat sink and sink.connection_params (V3-style)
  const cp = (sink.connection_params as Record<string, unknown> | undefined) ?? {}
  const host = String(sink.host ?? cp.host ?? '')
  const httpPort = Number(sink.http_port ?? sink.port ?? cp.http_port ?? cp.port ?? 8123)
  const database = String(sink.database ?? cp.database ?? '')
  const username = String(sink.username ?? cp.username ?? '')
  let rawPassword = sink.password ?? cp.password ?? ''
  let decodedPassword = String(rawPassword)
  try {
    if (rawPassword && typeof rawPassword === 'string') {
      const d = atob(rawPassword)
      if (d && !/[\x00-\x1F\x7F]/.test(d)) decodedPassword = d
    }
  } catch {
    decodedPassword = String(rawPassword)
  }
  const chConfig: ClickHouseConfig = {
    host,
    httpPort,
    username,
    password: decodedPassword,
    database,
    useSSL: Boolean(sink.secure ?? cp.secure ?? true),
    skipCertificateVerification: Boolean(sink.skip_certificate_verification ?? cp.skip_certificate_verification ?? false),
  }
  return {
    chConfig,
    params: {
      database,
      table: String(sink.table ?? ''),
      engine: String(sink.engine ?? 'MergeTree'),
      orderBy: String(sink.order_by ?? columns[0]!.name),
      columns,
    },
  }
}

export async function POST(request: Request) {
  let config: Record<string, any>
  try {
    config = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  try {
    // Create new table flow: create table first, then pipeline
    const createTableParams = isCreateNewTableFlow(config)
      ? buildCreateTableParams(config)
      : null

    if (createTableParams) {
      structuredLogger.info('Create new table flow: creating ClickHouse table before pipeline', {
        database: createTableParams.params.database,
        table: createTableParams.params.table,
        engine: createTableParams.params.engine,
        orderBy: createTableParams.params.orderBy,
        columnCount: createTableParams.params.columns.length,
      })
      const clickhouseService = new ClickhouseService()
      const createResult = await clickhouseService.createTable(
        createTableParams.chConfig,
        createTableParams.params
      )
      if (!createResult.success) {
        structuredLogger.error('ClickHouse table creation failed', {
          database: createTableParams.params.database,
          table: createTableParams.params.table,
          error: createResult.error,
        })
        return NextResponse.json(
          { success: false, error: createResult.error ?? 'Failed to create ClickHouse table' },
          { status: 400 }
        )
      }
      structuredLogger.info('ClickHouse table created successfully', {
        database: createTableParams.params.database,
        table: createTableParams.params.table,
      })
    }

    // Normalize Kafka broker hosts for Docker backend: localhost/127.0.0.1 -> host.docker.internal
    if (config?.source?.connection_params?.brokers && Array.isArray(config.source.connection_params.brokers)) {
      config.source.connection_params.brokers = config.source.connection_params.brokers.map((b: string) => {
        if (!b) return b
        const [host, port] = b.split(':')
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
        return isLocal ? `host.docker.internal${port ? `:${port}` : ''}` : b
      })
    }

    // Safety: Backend ClickHouse client uses the native protocol on sink.port.
    // If a client mistakenly sends HTTP port and a separate native_port, prefer native_port for backend.
    // Ensure http_port is set so the UI (e.g. metrics-from-config) can connect via HTTP when fetching pipeline.
    if (config?.sink?.native_port) {
      const existingHttpPort = config.sink.http_port ?? config.sink.connection_params?.http_port
      if (existingHttpPort === undefined || existingHttpPort === '') {
        config.sink.http_port = '8123'
      }
      config.sink.port = String(config.sink.native_port)
      delete config.sink.native_port
    }

    // Backend schema does not include UI-only / create-table properties — strip before forwarding
    // to avoid Huma validation errors ("unexpected property").
    if (config?.sink) {
      delete config.sink.destination_path
      delete config.sink.engine
      delete config.sink.order_by
      delete config.sink.table_name
    }

    const response = await axios.post(`${API_URL}/pipeline`, config)

    return NextResponse.json({
      success: true,
      pipeline: {
        pipeline_id: response.data.pipeline_id,
        status: 'active',
        ...response.data,
      },
    })
  } catch (error: unknown) {
    // Pipeline creation failed; if we created the table, attempt rollback
    const createTableParams = isCreateNewTableFlow(config)
      ? buildCreateTableParams(config)
      : null

    if (createTableParams) {
      const clickhouseService = new ClickhouseService()
      const dropResult = await clickhouseService.dropTable(
        createTableParams.chConfig,
        createTableParams.params.database,
        createTableParams.params.table
      )
      if (!dropResult.success) {
        const message = getBackendErrorMessage(
          axios.isAxiosError(error) && error.response ? error.response.data : null,
          'Failed to create pipeline'
        )
        return NextResponse.json(
          {
            success: false,
            error: message,
            orphanTable: {
              database: createTableParams.params.database,
              table: createTableParams.params.table,
              message:
                'The table was created but pipeline deployment failed. Rollback (drop table) failed. You may need to drop the table manually if not needed.',
            },
          },
          { status: 500 }
        )
      }
    }

    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response
      const message = getBackendErrorMessage(data, 'Failed to create pipeline')
      structuredLogger.error('Pipeline POST backend error', { status, data: typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data) })
      return NextResponse.json({ success: false, error: message }, { status })
    }
    // Network/connection error (e.g. ECONNREFUSED when backend not running or wrong API_URL)
    const message = error instanceof Error ? error.message : 'Unknown error'
    structuredLogger.error('Pipeline POST backend unreachable', { error: message })
    return NextResponse.json(
      { success: false, error: `Backend unreachable: ${message}. Check API_URL and that the pipeline API is running.` },
      { status: 500 },
    )
  }
}

function getBackendErrorMessage(data: unknown, fallback: string): string {
  if (data === null || data === undefined) return fallback
  if (typeof data === 'string') return data || fallback
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.detail === 'string') return obj.detail
    if (obj.detail && typeof obj.detail === 'object' && typeof (obj.detail as { msg?: string }).msg === 'string')
      return (obj.detail as { msg: string }).msg
  }
  return fallback
}

export async function GET() {
  try {
    const response = await axios.get(`${API_URL}/pipeline`)

    return NextResponse.json({
      success: true,
      pipelines: response.data,
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response
      const message = getBackendErrorMessage(data, 'Failed to get pipelines')
      structuredLogger.error('Pipeline GET backend error', { status, data: typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data) })
      return NextResponse.json({ success: false, error: message }, { status })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    structuredLogger.error('Pipeline GET backend unreachable', { error: message })
    return NextResponse.json(
      { success: false, error: `Backend unreachable: ${message}. Check API_URL and that the pipeline API is running.` },
      { status: 500 },
    )
  }
}

// DELETE method is handled by /ui-api/pipeline/[id]/route.ts for individual pipeline shutdown
// This route only handles GET (list all pipelines) and POST (create pipeline)
