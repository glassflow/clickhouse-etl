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

  // 1. Set the basic destination config
  const destination = mapBackendClickhouseDestinationToStore(sink)
  useStore.getState().clickhouseDestinationStore.setClickhouseDestination(destination)

  // 2. Fetch databases
  const dbRes = await fetch('/api/clickhouse/databases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: sink.host,
      port: sink.port,
      username: sink.username,
      password: sink.password,
      secure: sink.secure,
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
      port: sink.port,
      username: sink.username,
      password: sink.password,
      secure: sink.secure,
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
      port: sink.port,
      username: sink.username,
      password: sink.password,
      secure: sink.secure,
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
