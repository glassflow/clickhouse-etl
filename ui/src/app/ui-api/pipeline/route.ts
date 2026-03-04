import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'
import { structuredLogger } from '@/src/observability'
import { ClickhouseService } from '@/src/services/clickhouse-service'
import type { ClickHouseConfig } from '../clickhouse/clickhouse-utils'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

/** Detect "create new table" flow: sink has engine, order_by, and table_mapping with columns */
function isCreateNewTableFlow(config: { sink?: Record<string, unknown> }): boolean {
  const sink = config?.sink
  if (!sink || typeof sink !== 'object') return false
  if (!sink.engine || !sink.order_by) return false
  const mapping = sink.table_mapping
  if (!Array.isArray(mapping) || mapping.length === 0) return false
  const hasColumns = mapping.some(
    (m: { column_name?: string; column_type?: string }) =>
      m?.column_name && m?.column_type
  )
  return !!sink.database && !!sink.table && hasColumns
}

/** Build ClickHouse config and create-table params from pipeline sink config */
function buildCreateTableParams(config: { sink?: Record<string, unknown> }): {
  chConfig: ClickHouseConfig
  params: { database: string; table: string; engine: string; orderBy: string; columns: Array<{ name: string; type: string }> }
} | null {
  const sink = config?.sink as Record<string, unknown> | undefined
  if (!sink) return null
  let decodedPassword = String(sink.password ?? '')
  try {
    if (sink.password && typeof sink.password === 'string') {
      const d = atob(sink.password)
      if (d && !/[\x00-\x1F\x7F]/.test(d)) decodedPassword = d
    }
  } catch {
    decodedPassword = String(sink.password ?? '')
  }
  const httpPort = Number(sink.http_port ?? sink.port ?? 8123)
  const chConfig: ClickHouseConfig = {
    host: String(sink.host ?? ''),
    httpPort,
    username: String(sink.username ?? ''),
    password: decodedPassword,
    database: String(sink.database ?? ''),
    useSSL: Boolean(sink.secure ?? true),
    skipCertificateVerification: Boolean(sink.skip_certificate_verification ?? false),
  }
  const mapping = (sink.table_mapping ?? []) as Array<{ column_name?: string; column_type?: string }>
  const columns = mapping
    .filter((m) => m?.column_name && m?.column_type)
    .map((m) => ({ name: String(m.column_name), type: String(m.column_type) }))
  if (columns.length === 0) return null
  return {
    chConfig,
    params: {
      database: String(sink.database ?? ''),
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
      const clickhouseService = new ClickhouseService()
      const createResult = await clickhouseService.createTable(
        createTableParams.chConfig,
        createTableParams.params
      )
      if (!createResult.success) {
        return NextResponse.json(
          { success: false, error: createResult.error ?? 'Failed to create ClickHouse table' },
          { status: 400 }
        )
      }
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
    if (config?.sink?.native_port) {
      config.sink.port = String(config.sink.native_port)
      delete config.sink.native_port
    }

    // Backend schema does not include engine/order_by - strip before forwarding to avoid validation error.
    // These are only needed for create-table (done above); backend sink only needs table/mapping for INSERT.
    if (config?.sink) {
      delete config.sink.engine
      delete config.sink.order_by
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
      structuredLogger.error('Pipeline POST backend error', {
        status,
        data: typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data),
      })
      return NextResponse.json({ success: false, error: message }, { status })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    structuredLogger.error('Pipeline POST backend unreachable', { error: message })
    return NextResponse.json(
      { success: false, error: `Backend unreachable: ${message}. Check API_URL and that the pipeline API is running.` },
      { status: 500 }
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
