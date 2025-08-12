import { useStore } from '../index'

// Helper: Map backend config to your store's destination shape
function mapBackendClickhouseDestinationToStore(sink: any) {
  return {
    scheme: '', // If you use this, fill from config or leave empty
    database: sink.database || '',
    table: sink.table || '',
    mapping: sink.table_mapping || [],
    destinationColumns: [], // Will fill after fetching schema
    maxBatchSize: sink.max_batch_size || 1000,
    maxDelayTime: typeof sink.max_delay_time === 'string' ? parseInt(sink.max_delay_time) : sink.max_delay_time || 1,
    maxDelayTimeUnit: typeof sink.max_delay_time === 'string' ? sink.max_delay_time.replace(/[0-9]/g, '') || 'm' : 'm',
  }
}

export async function hydrateClickhouseDestination(pipelineConfig: any) {
  const sink = pipelineConfig?.sink
  if (!sink) return

  console.log('hydrateClickhouseDestination - sink config:', JSON.stringify(sink, null, 2))

  // Decode base64 password if it's encoded
  let decodedPassword = sink.password || ''
  try {
    // Check if password is base64 encoded by trying to decode it
    if (sink.password && typeof sink.password === 'string') {
      const decoded = atob(sink.password)
      // If decoding succeeds and doesn't contain control characters, use decoded version
      if (decoded && !/[\x00-\x1F\x7F]/.test(decoded)) {
        decodedPassword = decoded
        console.log('hydrateClickhouseDestination - password decoded from base64:', decoded)
      } else {
        console.log(
          'hydrateClickhouseDestination - password appears to be already decoded or contains control characters',
        )
      }
    }
  } catch (error) {
    // If decoding fails, use original password (might not be base64 encoded)
    decodedPassword = sink.password || ''
    console.log('hydrateClickhouseDestination - password decoding failed, using original:', error)
  }

  // 1. Set the basic destination config
  const destination = mapBackendClickhouseDestinationToStore(sink)
  useStore.getState().clickhouseDestinationStore.setClickhouseDestination(destination)

  // 2. Fetch databases
  // Ensure we pass required fields and map nativePort/HTTP port correctly
  console.log('hydrateClickhouseDestination - sending config for databases:', {
    host: sink.host,
    httpPort: sink.http_port,
    nativePort: sink.port,
    username: sink.username,
    useSSL: sink.secure,
  })

  const dbRes = await fetch('/api/clickhouse/databases', {
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
  if (!dbData.success) throw new Error(dbData.error || 'Failed to fetch databases')
  // Optionally: useStore.getState().clickhouseConnectionStore.updateDatabases(dbData.databases, ...)

  // 3. Fetch tables for the selected database
  const tablesRes = await fetch('/api/clickhouse/tables', {
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
  if (!tablesData.success) throw new Error(tablesData.error || 'Failed to fetch tables')
  // Optionally: useStore.getState().clickhouseConnectionStore.updateTables(sink.database, tablesData.tables, ...)

  // 4. Fetch schema for the selected table
  const schemaRes = await fetch('/api/clickhouse/schema', {
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
  if (!schemaData.success) throw new Error(schemaData.error || 'Failed to fetch schema')

  // 5. Fill destinationColumns in the store with the schema
  useStore.getState().clickhouseDestinationStore.setClickhouseDestination({
    ...destination,
    destinationColumns: schemaData.columns || [],
  })
}
