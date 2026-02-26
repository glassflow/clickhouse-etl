import { useStore } from '../index'

// Helper: Map backend config to your store's destination shape
// schemaFields is optional and used for V2 format where mapping is in schema.fields instead of sink.table_mapping
function mapBackendClickhouseDestinationToStore(sink: any, schemaFields?: any[]) {
  // Parse max_delay_time from Go duration format (e.g., "1m", "30s", "2h", "55h0m0s")
  let maxDelayTime = 1
  let maxDelayTimeUnit = 'm'

  if (sink.max_delay_time) {
    if (typeof sink.max_delay_time === 'string') {
      const timeWindow = sink.max_delay_time

      // Parse complex Go duration format like "55h0m0s", "1h30m", "2d12h", etc.
      // Go duration format can have multiple units like "72h30m45s"
      const matches = timeWindow.match(/(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)

      if (matches) {
        const days = parseInt(matches[1] || '0')
        const hours = parseInt(matches[2] || '0')
        const minutes = parseInt(matches[3] || '0')
        const seconds = parseInt(matches[4] || '0')

        // Convert to total seconds for easier calculation
        const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds

        // Normalize to the largest appropriate unit for UI display
        if (totalSeconds >= 86400 && totalSeconds % 86400 === 0) {
          // Exact days
          maxDelayTime = Math.round(totalSeconds / 86400)
          maxDelayTimeUnit = 'd'
        } else if (totalSeconds >= 3600 && totalSeconds % 3600 === 0) {
          // Exact hours
          maxDelayTime = Math.round(totalSeconds / 3600)
          maxDelayTimeUnit = 'h'
        } else if (totalSeconds >= 3600) {
          // More than an hour but not exact hours - convert to hours anyway
          maxDelayTime = Math.round(totalSeconds / 3600)
          maxDelayTimeUnit = 'h'
        } else if (totalSeconds >= 60) {
          // 1 minute or more - use minutes
          maxDelayTime = Math.round(totalSeconds / 60)
          maxDelayTimeUnit = 'm'
        } else {
          // Less than 1 minute - use seconds
          maxDelayTime = totalSeconds
          maxDelayTimeUnit = 's'
        }
      }
    } else if (typeof sink.max_delay_time === 'number') {
      maxDelayTime = sink.max_delay_time
      maxDelayTimeUnit = 'm' // Default unit for numeric values
    }
  }

  // Transform backend mapping format to UI format
  // Support both V1 format (sink.table_mapping) and V2 format (schema.fields)
  // Backend format: { source_id, field_name, column_name, column_type }
  // UI format: { name, type, eventField, sourceTopic, jsonType, isNullable }
  let backendMapping: any[] = []
  if (Array.isArray(sink.table_mapping) && sink.table_mapping.length > 0) {
    // V1 format: mapping is in sink.table_mapping
    backendMapping = sink.table_mapping
  } else if (Array.isArray(schemaFields) && schemaFields.length > 0) {
    // V2 format: mapping is in schema.fields
    // Only include fields that are mapped to the sink (have column_name and column_type) to avoid
    // duplicating raw topic fields that are already represented as transform outputs.
    const mappedFields = schemaFields.filter(
      (field: any) => field.column_name && field.column_type,
    )
    backendMapping = mappedFields.map((field: any) => ({
      source_id: field.source_id,
      field_name: field.name, // In V2, 'name' is the Kafka field name
      column_name: field.column_name,
      column_type: field.column_type,
    }))
  }

  const uiMapping = backendMapping.map((m: any) => ({
    name: m.column_name || '',
    type: m.column_type || '',
    eventField: m.field_name || m.eventField || '',
    sourceTopic: m.source_id || '',
    jsonType: mapClickHouseTypeToJsonType(m.column_type || ''),
    isNullable: (m.column_type || '').includes('Nullable'),
  }))

  return {
    scheme: '', // If you use this, fill from config or leave empty
    database: sink.database || '',
    table: sink.table || '',
    mapping: uiMapping,
    destinationColumns: [], // Will fill after fetching schema
    maxBatchSize: sink.max_batch_size || 1000,
    maxDelayTime,
    maxDelayTimeUnit,
  }
}

// Best-effort mapping from ClickHouse type to JSON type used by UI
function mapClickHouseTypeToJsonType(clickhouseType: string): string {
  const t = (clickhouseType || '').toLowerCase()
  if (!t) return ''

  // Remove wrappers like Nullable(...) and LowCardinality(...)
  const unwrapped = t.replace(/nullable\((.*)\)/, '$1').replace(/lowcardinality\((.*)\)/, '$1')

  if (unwrapped.startsWith('string') || unwrapped.startsWith('fixedstring') || unwrapped.includes('uuid'))
    return 'string'
  if (unwrapped.startsWith('bool') || unwrapped === 'boolean') return 'bool'
  if (unwrapped.startsWith('u')) return 'uint'
  if (unwrapped.startsWith('int')) return 'int'
  if (unwrapped.startsWith('float') || unwrapped.startsWith('decimal')) return 'float'
  if (unwrapped.startsWith('date') || unwrapped.startsWith('datetime')) return 'string'
  if (unwrapped.startsWith('array')) return 'array'
  if (unwrapped.startsWith('map')) return 'bytes'

  return 'string'
}

export async function hydrateClickhouseDestination(pipelineConfig: any) {
  const sink = pipelineConfig?.sink
  if (!sink) return

  // Decode base64 password if it's encoded
  let decodedPassword = sink.password || ''
  try {
    // Check if password is base64 encoded by trying to decode it
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

  // 1. Set the basic destination config (pass schema.fields for V2 format support)
  const destination = mapBackendClickhouseDestinationToStore(sink, pipelineConfig?.schema?.fields)
  useStore.getState().clickhouseDestinationStore.setClickhouseDestination(destination)

  // 2. Fetch databases
  const dbRes = await fetch('/ui-api/clickhouse/databases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: sink.host,
      // Backend stores sink.port as native port; for HTTP driver we pass it as number
      httpPort: Number(sink.http_port),
      nativePort: Number(sink.port),
      username: sink.username,
      password: decodedPassword,
      useSSL: sink.secure,
      skipCertificateVerification: sink.skip_certificate_verification,
    }),
  })
  const dbData = await dbRes.json()

  if (!dbData.success) {
    console.error('[Hydration] Failed to fetch databases:', dbData.error)
    // Don't throw - just log and continue with what we have
    // This prevents infinite retry loops
    console.warn('[Hydration] Continuing with basic destination setup (databases unavailable)')
    return // Exit gracefully instead of throwing
  }

  // 3. Fetch tables for the selected database

  const tablesRes = await fetch('/ui-api/clickhouse/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: sink.host,
      httpPort: Number(sink.http_port),
      nativePort: Number(sink.port),
      username: sink.username,
      password: decodedPassword,
      useSSL: sink.secure,
      skipCertificateVerification: sink.skip_certificate_verification,
      database: sink.database,
    }),
  })
  const tablesData = await tablesRes.json()

  if (!tablesData.success) {
    console.error('[Hydration] Failed to fetch tables:', tablesData.error)
    console.warn('[Hydration] Continuing with basic destination setup (tables unavailable)')
    return // Exit gracefully
  }

  // 4. Fetch schema for the selected table

  const schemaRes = await fetch('/ui-api/clickhouse/schema', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: sink.host,
      httpPort: Number(sink.http_port),
      nativePort: Number(sink.port),
      username: sink.username,
      password: decodedPassword,
      useSSL: sink.secure,
      skipCertificateVerification: sink.skip_certificate_verification,
      database: sink.database,
      table: sink.table,
    }),
  })
  const schemaData = await schemaRes.json()

  if (!schemaData.success) {
    console.error('[Hydration] Failed to fetch schema:', schemaData.error)
    console.warn('[Hydration] Continuing with basic destination setup (schema unavailable)')
    return // Exit gracefully
  }

  const schemaColumns: Array<{ name: string; type: string; isNullable?: boolean; column_type?: string }> =
    schemaData.columns || []

  // Filter out MATERIALIZED and ALIAS columns - import the utility at the top
  const { filterUserMappableColumns } = await import('@/src/modules/clickhouse/utils')
  const mappableColumns = filterUserMappableColumns(schemaColumns as any)

  // 5. Transform backend mapping into UI mapping shape aligned with schema
  // Support both V1 format (sink.table_mapping) and V2 format (schema.fields)
  let backendMapping: any[] = []
  if (Array.isArray(sink.table_mapping) && sink.table_mapping.length > 0) {
    // V1 format: mapping is in sink.table_mapping
    backendMapping = sink.table_mapping
  } else if (Array.isArray(pipelineConfig?.schema?.fields) && pipelineConfig.schema.fields.length > 0) {
    // V2 format: mapping is in schema.fields
    // Only include fields that are mapped to the sink (have column_name and column_type).
    const mappedFields = pipelineConfig.schema.fields.filter(
      (field: any) => field.column_name && field.column_type,
    )
    backendMapping = mappedFields.map((field: any) => ({
      source_id: field.source_id,
      field_name: field.name, // In V2, 'name' is the Kafka field name
      column_name: field.column_name,
      column_type: field.column_type,
    }))
  }

  const uiMapping = mappableColumns.map((col) => {
    const found = backendMapping.find((m: any) => (m.column_name || m.name) === col.name)
    const columnType = col.type || (col as any).column_type || ''

    // Derive a best-effort jsonType from ClickHouse type if event-derived inference is unavailable
    const derivedJsonType = mapClickHouseTypeToJsonType(columnType)

    return {
      // UI mapping shape expected by ClickhouseMapper / FieldColumnMapper
      name: col.name,
      type: columnType,
      isNullable: col.isNullable === true || (col.type || (col as any).column_type || '').includes('Nullable'),
      jsonType: found?.jsonType || derivedJsonType,
      eventField: found?.field_name || found?.eventField || '',
      // For join journeys preserve source topic if present from backend
      ...(found?.source_id ? { sourceTopic: found.source_id } : {}),
    }
  })

  // 6. Update the destination in store with schema and transformed mapping (only mappable columns)
  useStore.getState().clickhouseDestinationStore.setClickhouseDestination({
    ...destination,
    destinationColumns: mappableColumns.map((c) => ({
      name: c.name,
      type: c.type || (c as any).column_type || '',
      isNullable: c.isNullable === true || (c.type || (c as any).column_type || '').includes('Nullable'),
      default_type: (c as any).default_type || '',
      default_expression: (c as any).default_expression || '',
      default_kind: (c as any).default_kind || '',
    })),
    mapping: uiMapping,
  })
}
