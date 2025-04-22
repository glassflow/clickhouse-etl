// Define fetchTableSchema outside of effects so it can be referenced anywhere
import { TableSchema, TableColumn, ConnectionConfig } from './types'
import { inferJsonType } from './helpers'

export const useFetchTableSchema = ({
  selectedDatabase,
  selectedTable,
  setTableSchema,
  setIsLoading,
  setError,
  getConnectionConfig,
  setMappedColumns,
  setSuccess,
}: {
  selectedDatabase: string
  selectedTable: string
  setTableSchema: (schema: TableSchema) => void
  setIsLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  getConnectionConfig: () => Omit<ConnectionConfig, 'connectionType'>
  setMappedColumns: (columns: TableColumn[]) => void
  setSuccess: (success: string) => void
}) => {
  const fetchTableSchema = async () => {
    if (!selectedDatabase || !selectedTable) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/clickhouse/schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...getConnectionConfig(),
          database: selectedDatabase,
          table: selectedTable,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setTableSchema({ columns: data.columns || [] })
        setError(null)

        // Initialize mapped columns with schema data
        const initialMappedColumns = data.columns.map((col: TableColumn) => ({
          ...col,
          jsonType: inferJsonType(col.type),
          isNullable: col.type.includes('Nullable'),
          isKey: col.isKey || false, // Use the isKey property from the API response
          eventField: '',
        }))

        setMappedColumns(initialMappedColumns)
        setSuccess('Table schema loaded successfully')
      } else {
        setError(data.error || `Failed to fetch schema for table '${selectedTable}'`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return { fetchTableSchema }
}
