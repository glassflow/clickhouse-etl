import { NextResponse } from 'next/server'
import { createClickHouseConnection, closeConnection } from '../../../../clickhouse/clickhouse-utils'
import { validatePipelineIdOrError } from '../../../validation'
import { structuredLogger } from '@/src/observability'

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Validate pipeline ID format before processing
  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    const body = await request.json()
    const { pipeline } = body

    if (!pipeline) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pipeline configuration is required',
        },
        { status: 400 },
      )
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
    structuredLogger.error('ClickHouse Metrics from Config API Route error', { error: error.message, response: error.response?.data, status: error.response?.status })

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
    // Basic table info and row count - try multiple approaches
    tableInfo: `
      SELECT
        count() as row_count,
        sum(data_compressed_bytes) as compressed_size_bytes,
        sum(data_uncompressed_bytes) as table_size_bytes
      FROM system.parts
      WHERE database = '${database}' AND table = '${table}' AND active = 1
    `,

    // Fallback: Direct table count if system.parts is empty
    tableInfoDirect: `
      SELECT
        count() as row_count,
        0 as compressed_size_bytes,
        0 as table_size_bytes
      FROM ${database}.${table}
    `,

    // Table size from system.tables (most reliable for actual disk usage)
    tableSize: `
      SELECT
        total_rows as row_count,
        total_bytes as compressed_size_bytes,
        0 as table_size_bytes
      FROM system.tables
      WHERE database = '${database}' AND name = '${table}'
    `,

    // Insert rate from query_log (last minute) - using written_rows instead of read_rows
    insertRate: `
      SELECT
        count() as insert_count,
        sum(written_rows) as total_rows,
        sum(written_bytes) as total_bytes,
        min(event_time) as earliest_insert,
        max(event_time) as latest_insert
      FROM system.query_log
      WHERE event_date >= today() - 5
        AND event_time >= now() - INTERVAL 5 MINUTE
        AND query LIKE '%INSERT INTO ${database}.${table}%'
        AND query NOT LIKE '%system.%'
        AND type = 'QueryFinish'
        AND written_rows > 0
    `,

    // Insert latency from query_log
    insertLatency: `
      SELECT
        quantile(0.5)(query_duration_ms) as p50_latency,
        quantile(0.95)(query_duration_ms) as p95_latency
      FROM system.query_log
      WHERE event_date >= today() - 1
        AND event_time >= now() - INTERVAL 1 HOUR
        AND query LIKE '%INSERT INTO ${database}.${table}%'
        AND query NOT LIKE '%system.%'
        AND type = 'QueryFinish'
        AND written_rows > 0
    `,

    // Failed inserts
    failedInserts: `
      SELECT count() as failed_count
      FROM system.query_log
      WHERE event_date >= today() - 5
        AND event_time >= now() - INTERVAL 5 MINUTE
        AND query LIKE '%INSERT INTO ${database}.${table}%'
        AND type = 'ExceptionWhileProcessing'
    `,

    // Table growth (delta over last hour)
    tableGrowth: `
      SELECT
        count() as current_rows,
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

    // Memory usage - only from currently running queries (real-time)
    memoryUsage: `
      SELECT
        sum(memory_usage) as memory_usage_bytes
      FROM system.processes
      WHERE query LIKE '%INSERT INTO ${database}.${table}%'
        AND query NOT LIKE '%system.%'
    `,

    // Peak memory from recent inserts (not sum, but max to avoid accumulation)
    memoryUsageFromLog: `
      SELECT
        max(memory_usage) as memory_usage_bytes
      FROM system.query_log
      WHERE event_date >= today() - 1
        AND event_time >= now() - INTERVAL 5 MINUTE
        AND query LIKE '%INSERT INTO ${database}.${table}%'
        AND query NOT LIKE '%system.%'
        AND type = 'QueryFinish'
        AND memory_usage > 0
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
      structuredLogger.warn('Failed to execute ClickHouse query', { key, error: error instanceof Error ? error.message : String(error) })
      results[key] = {}
    }
  }

  // Helper function to safely convert to number
  const toNumber = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0
    const num = Number(value)
    return isNaN(num) ? 0 : num
  }

  // Calculate insert rate (rows per second) - use actual time range, not fixed 60 seconds
  const insertRateData = results.insertRate || {}
  const insertCount = toNumber(insertRateData.insert_count)

  let insertRateRowsPerSec = 0
  let insertRateBytesPerSec = 0

  if (insertCount > 0 && insertRateData.earliest_insert && insertRateData.latest_insert) {
    // Calculate actual time span in seconds
    const earliestTime = new Date(insertRateData.earliest_insert).getTime()
    const latestTime = new Date(insertRateData.latest_insert).getTime()
    const timeSpanSeconds = Math.max(1, (latestTime - earliestTime) / 1000) // Minimum 1 second

    insertRateRowsPerSec = toNumber(insertRateData.total_rows) / timeSpanSeconds
    insertRateBytesPerSec = toNumber(insertRateData.total_bytes) / timeSpanSeconds
  }

  // Get table info - use multiple fallbacks for reliability
  const tableInfo = results.tableInfo || {}
  const tableInfoDirect = results.tableInfoDirect || {}
  const tableSizeInfo = results.tableSize || {}

  // Convert to numbers and use fallback logic (priority: system.tables > system.parts > direct count)
  const rowCountFromTables = toNumber(tableSizeInfo.row_count)
  const rowCountFromParts = toNumber(tableInfo.row_count)
  const rowCountFromDirect = toNumber(tableInfoDirect.row_count)
  const rowCount =
    rowCountFromTables > 0 ? rowCountFromTables : rowCountFromParts > 0 ? rowCountFromParts : rowCountFromDirect

  const tableSizeBytesFromParts = toNumber(tableInfo.table_size_bytes)
  const tableSizeBytesFromDirect = toNumber(tableInfoDirect.table_size_bytes)
  const tableSizeBytes = tableSizeBytesFromParts > 0 ? tableSizeBytesFromParts : tableSizeBytesFromDirect

  // For compressed size, prefer system.tables (total_bytes) over system.parts
  const compressedSizeBytesFromTables = toNumber(tableSizeInfo.compressed_size_bytes)
  const compressedSizeBytesFromParts = toNumber(tableInfo.compressed_size_bytes)
  const compressedSizeBytesFromDirect = toNumber(tableInfoDirect.compressed_size_bytes)
  const compressedSizeBytes =
    compressedSizeBytesFromTables > 0
      ? compressedSizeBytesFromTables
      : compressedSizeBytesFromParts > 0
        ? compressedSizeBytesFromParts
        : compressedSizeBytesFromDirect

  // Get latency data
  const latencyData = results.insertLatency || {}
  const insertLatencyP50Ms = toNumber(latencyData.p50_latency)
  const insertLatencyP95Ms = toNumber(latencyData.p95_latency)

  // Get failed inserts
  const failedData = results.failedInserts || {}
  const failedInserts = toNumber(failedData.failed_count)

  // Get merge pressure
  const mergeData = results.mergePressure || {}
  const mergesInProgress = toNumber(mergeData.merges_in_progress)
  const mutationsInProgress = toNumber(mergeData.mutations_in_progress)

  // Get memory usage - try both sources
  const memoryData = results.memoryUsage || {}
  const memoryDataFromLog = results.memoryUsageFromLog || {}
  const memoryUsageBytesFromProc = toNumber(memoryData.memory_usage_bytes)
  const memoryUsageBytesFromLog = toNumber(memoryDataFromLog.memory_usage_bytes)
  const memoryUsageBytes = memoryUsageBytesFromProc > 0 ? memoryUsageBytesFromProc : memoryUsageBytesFromLog

  // Get active queries
  const activeQueriesData = results.activeQueries || {}
  const activeQueries = toNumber(activeQueriesData.active_queries)

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
    structuredLogger.warn('Failed to parse ClickHouse query result', { error: error instanceof Error ? error.message : String(error) })
    return {}
  }
}
