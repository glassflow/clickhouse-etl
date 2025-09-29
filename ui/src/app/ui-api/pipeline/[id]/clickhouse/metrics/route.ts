import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../../config'
import { createClickHouseConnection, closeConnection } from '../../../../clickhouse/clickhouse-utils'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

interface ClickHouseTableMetrics {
  database: string
  table: string
  lastUpdated: string
  rowCount: number
  tableSizeBytes: number
  compressedSizeBytes: number
  insertRateRowsPerSec: number
  insertRateBytesPerSec: number
  insertLatencyP50Ms: number
  insertLatencyP95Ms: number
  failedInserts: number
  failedInsertsLast5Min: number
  rowCountDelta1H: number
  tableSizeDelta1H: number
  mergesInProgress: number
  mutationsInProgress: number
  memoryUsageBytes: number
  activeQueries: number
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    if (!id || id.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Pipeline ID is required',
        },
        { status: 400 },
      )
    }

    // First, get the pipeline configuration to extract ClickHouse connection details
    let pipeline
    try {
      const pipelineResponse = await axios.get(`${API_URL}/pipeline/${id}`, {
        timeout: 10000,
      })

      if (!pipelineResponse.data) {
        return NextResponse.json(
          {
            success: false,
            error: 'Pipeline not found',
          },
          { status: 404 },
        )
      }

      pipeline = pipelineResponse.data
    } catch (pipelineError: any) {
      // If pipeline doesn't exist in backend, return appropriate error
      if (pipelineError.response?.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: 'Pipeline not found in backend',
          },
          { status: 404 },
        )
      }

      // For other errors, re-throw to be handled by outer catch
      throw pipelineError
    }

    const sink = pipeline.sink

    if (!sink || sink.type !== 'clickhouse') {
      return NextResponse.json(
        {
          success: false,
          error: 'Pipeline does not have a ClickHouse sink',
        },
        { status: 400 },
      )
    }

    // Extract ClickHouse connection parameters
    // Decode base64 password if it's encoded
    let decodedPassword = sink.password || ''
    try {
      if (sink.password && typeof sink.password === 'string') {
        const decoded = atob(sink.password)
        // If decoding succeeds and doesn't contain control characters, use decoded version
        if (decoded && !/[\x00-\x1F\x7F]/.test(decoded)) {
          decodedPassword = decoded
        } else {
          console.log('Password appears to be already decoded or contains control characters')
        }
      }
    } catch (error) {
      // If decoding fails, use original password (might not be base64 encoded)
      decodedPassword = sink.password || ''
    }

    const clickhouseConfig = {
      host: sink.host,
      httpPort: parseInt(sink.http_port || sink.port),
      nativePort: sink.native_port ? parseInt(sink.native_port) : undefined,
      username: sink.username,
      password: decodedPassword,
      database: sink.database,
      useSSL: sink.secure || false,
      skipCertificateVerification: sink.skip_certificate_verification || false,
    }

    // Connect to ClickHouse and fetch metrics
    const connection = await createClickHouseConnection(clickhouseConfig)

    try {
      const metrics = await fetchClickHouseTableMetrics(connection, sink.database, sink.table)
      await closeConnection(connection)

      return NextResponse.json({
        success: true,
        metrics,
      })
    } catch (metricsError) {
      await closeConnection(connection)
      throw metricsError
    }
  } catch (error: any) {
    console.error('ClickHouse Metrics API Route - Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config,
    })

    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data?.message || `Failed to fetch ClickHouse metrics for pipeline ${id}`,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch ClickHouse metrics for pipeline ${id}: ${error.message}`,
      },
      { status: 500 },
    )
  }
}

async function fetchClickHouseTableMetrics(
  connection: any,
  database: string,
  table: string,
): Promise<ClickHouseTableMetrics> {
  const queries = {
    // Basic table info and row count
    tableInfo: `
      SELECT
        sum(rows) as row_count,
        sum(data_compressed_bytes) as compressed_size_bytes,
        sum(data_uncompressed_bytes) as table_size_bytes
      FROM system.parts
      WHERE database = '${database}' AND table = '${table}' AND active = 1
    `,

    // Insert rate from query_log (last minute) - using written_rows instead of read_rows
    insertRate: `
      SELECT
        sum(rows) as insert_count,
        sum(written_rows) as total_rows,
        sum(written_bytes) as total_bytes
      FROM system.query_log 
      WHERE event_date >= today() - 10 
        AND event_time >= now() - INTERVAL 1 MINUTE
        AND query LIKE '%INSERT INTO ${database}.${table}%'
        AND type = 'QueryFinish'
        AND written_rows > 0
    `,

    // Insert latency from query_log
    insertLatency: `
      SELECT
        quantile(0.5)(query_duration_ms) as p50_latency,
        quantile(0.95)(query_duration_ms) as p95_latency
      FROM system.query_log
      WHERE event_date >= today() - 10
        AND event_time >= now() - INTERVAL 1 HOUR
        AND query LIKE '%INSERT INTO ${database}.${table}%'
        AND type = 'QueryFinish'
    `,

    // Failed inserts
    failedInserts: `
      SELECT count() as failed_count
      FROM system.query_log
      WHERE event_date >= today() - 10
        AND event_time >= now() - INTERVAL 5 MINUTE
        AND query LIKE '%INSERT INTO ${database}.${table}%'
        AND type = 'ExceptionWhileProcessing'
    `,

    // Table growth (delta over last hour)
    tableGrowth: `
      SELECT
        sum(rows) as current_rows,
        sum(data_compressed_bytes) as current_size
      FROM system.parts
      WHERE database = '${database}' AND table = '${table}' AND active = 1
    `,

    // Merge pressure - using correct column names for system.merges
    mergePressure: `
      SELECT
        count() as merges_in_progress,
        0 as mutations_in_progress
      FROM system.merges
      WHERE database = '${database}' AND table = '${table}'
    `,

    // Memory usage
    memoryUsage: `
      SELECT
        sum(memory_usage) as memory_usage_bytes
      FROM system.processes
      WHERE query LIKE '%${database}.${table}%'
    `,

    // Active queries
    activeQueries: `
      SELECT count() as active_queries
      FROM system.processes
      WHERE query LIKE '%${database}.${table}%'
    `,
  }

  const results: any = {}

  // Execute all queries with cache-busting
  for (const [key, query] of Object.entries(queries)) {
    try {
      // Add cache-busting to ensure fresh data
      const queryWithCacheBust = `${query} SETTINGS use_query_cache = 0`

      if (connection.type === 'direct' && connection.directFetch) {
        const data = await connection.directFetch(queryWithCacheBust)
        results[key] = parseQueryResult(data)
      } else if (connection.type === 'client' && connection.client) {
        const result = await connection.client.query({
          query: queryWithCacheBust,
          format: 'JSONEachRow',
        })
        const rows = await result.json()
        results[key] = rows[0] || {}
      }
    } catch (error) {
      console.warn(`Failed to execute query ${key}:`, error)
      results[key] = {}
    }
  }

  // Calculate insert rate (rows per second over last minute)
  const insertRateData = results.insertRate || {}
  const insertRateRowsPerSec = insertRateData.insert_count ? insertRateData.total_rows / 60 : 0
  const insertRateBytesPerSec = insertRateData.insert_count ? insertRateData.total_bytes / 60 : 0

  // Get table info
  const tableInfo = results.tableInfo || {}
  const rowCount = tableInfo.row_count || 0
  const tableSizeBytes = tableInfo.table_size_bytes || 0
  const compressedSizeBytes = tableInfo.compressed_size_bytes || 0

  // Get latency data
  const latencyData = results.insertLatency || {}
  const insertLatencyP50Ms = latencyData.p50_latency || 0
  const insertLatencyP95Ms = latencyData.p95_latency || 0

  // Get failed inserts
  const failedData = results.failedInserts || {}
  const failedInserts = failedData.failed_count || 0

  // Get merge pressure
  const mergeData = results.mergePressure || {}
  const mergesInProgress = mergeData.merges_in_progress || 0
  const mutationsInProgress = mergeData.mutations_in_progress || 0

  // Get memory usage
  const memoryData = results.memoryUsage || {}
  const memoryUsageBytes = memoryData.memory_usage_bytes || 0

  // Get active queries
  const activeQueriesData = results.activeQueries || {}
  const activeQueries = activeQueriesData.active_queries || 0

  return {
    database,
    table,
    lastUpdated: new Date().toISOString(),
    rowCount,
    tableSizeBytes,
    compressedSizeBytes,
    insertRateRowsPerSec,
    insertRateBytesPerSec,
    insertLatencyP50Ms,
    insertLatencyP95Ms,
    failedInserts,
    failedInsertsLast5Min: failedInserts, // Same as failed inserts for now
    rowCountDelta1H: 0, // TODO: Implement historical comparison
    tableSizeDelta1H: 0, // TODO: Implement historical comparison
    mergesInProgress,
    mutationsInProgress,
    memoryUsageBytes,
    activeQueries,
  }
}

function parseQueryResult(data: string): any {
  try {
    const lines = data
      .trim()
      .split('\n')
      .filter((line) => line.trim())
    if (lines.length === 0) return {}

    // Try to parse as JSON first
    try {
      return JSON.parse(lines[0])
    } catch {
      // If not JSON, try to parse as tab-separated values
      const values = lines[0].split('\t')

      // For queries that return multiple columns, we need to map them to expected column names
      // This is a fallback for when JSON parsing fails
      const result: any = {}
      values.forEach((value, index) => {
        // Convert to number if possible, otherwise keep as string
        const numValue = Number(value)
        result[`col_${index}`] = isNaN(numValue) ? value : numValue
      })

      // If we have multiple columns, try to map them to expected names based on common patterns
      if (values.length >= 3) {
        // Likely: count, compressed_bytes, uncompressed_bytes
        result.row_count = Number(values[0]) || 0
        result.compressed_size_bytes = Number(values[1]) || 0
        result.table_size_bytes = Number(values[2]) || 0
      } else if (values.length === 2) {
        // Likely: p50, p95 latency
        result.p50_latency = Number(values[0]) || 0
        result.p95_latency = Number(values[1]) || 0
      } else if (values.length === 1) {
        // Single value
        result.value = Number(values[0]) || 0
      }

      return result
    }
  } catch (error) {
    console.warn('Failed to parse query result:', error)
    return {}
  }
}
