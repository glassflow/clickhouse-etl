import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/src/store'
import { useClickhouseConnection } from '@/src/hooks/useClickhouseConnection'
import { useClickhouseDatabases } from '@/src/hooks/useClickhouseDatabases'
import { useClickhouseTables } from '@/src/hooks/useClickhouseTables'
import { useClickhouseTableSchema } from '@/src/hooks/useClickhouseTableSchema'
import { filterUserMappableColumns } from '../utils'
import type { TableColumn, TableSchema, ConnectionConfig } from '../types'

/**
 * Hook that owns all destination/schema/mapping and batch/delay state,
 * plus sync and load effects (connection reset, schema sync, hydration, fetch databases/tables/schema).
 * Keeps ClickhouseMapper state and data-loading logic in one place.
 */
export function useClickhouseMapperState() {
  const {
    clickhouseConnectionStore,
    clickhouseDestinationStore,
  } = useStore()
  const { clickhouseConnection, getTableSchema } = clickhouseConnectionStore
  const { clickhouseDestination, setClickhouseDestination, updateClickhouseDestinationDraft } =
    clickhouseDestinationStore

  const { connectionStatus } = clickhouseConnection
  const { testDatabaseAccess, testTableAccess } = useClickhouseConnection()

  const [selectedDatabase, setSelectedDatabase] = useState<string>(clickhouseDestination?.database || '')
  const [selectedTable, setSelectedTable] = useState<string>(clickhouseDestination?.table || '')
  const [tableSchema, setTableSchema] = useState<TableSchema>({
    columns: clickhouseDestination?.destinationColumns || [],
  })
  const [mappedColumns, setMappedColumns] = useState<TableColumn[]>(clickhouseDestination?.mapping || [])
  const [maxBatchSize, setMaxBatchSize] = useState(clickhouseDestination?.maxBatchSize || 1000)
  const [maxDelayTime, setMaxDelayTime] = useState(clickhouseDestination?.maxDelayTime || 1)
  const [maxDelayTimeUnit, setMaxDelayTimeUnit] = useState(clickhouseDestination?.maxDelayTimeUnit || 'm')
  const [isHydrated, setIsHydrated] = useState(false)

  const maxDelayTimeRef = useRef(maxDelayTime)
  const maxDelayTimeUnitRef = useRef(maxDelayTimeUnit)
  const maxBatchSizeRef = useRef(maxBatchSize)
  const lastConnectionRef = useRef<string>('')

  const { databases, isLoading: databasesLoading, error: databasesError, fetchDatabases } =
    useClickhouseDatabases()
  const {
    tables: availableTables,
    isLoading: tablesLoading,
    error: tablesError,
    fetchTables,
  } = useClickhouseTables(selectedDatabase)
  const {
    fetchTableSchema,
    schema: storeSchema,
    isLoading: schemaLoading,
    error: schemaError,
  } = useClickhouseTableSchema(selectedDatabase, selectedTable)

  const isLoading = databasesLoading || tablesLoading || schemaLoading
  const dataError = databasesError || tablesError || schemaError

  // Ref sync
  useEffect(() => {
    maxDelayTimeRef.current = maxDelayTime
  }, [maxDelayTime])
  useEffect(() => {
    maxDelayTimeUnitRef.current = maxDelayTimeUnit
  }, [maxDelayTimeUnit])
  useEffect(() => {
    maxBatchSizeRef.current = maxBatchSize
  }, [maxBatchSize])

  // Connection-change reset
  useEffect(() => {
    const currentConnectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.httpPort}:${clickhouseConnection.directConnection.username}`
    if (lastConnectionRef.current && lastConnectionRef.current !== currentConnectionId) {
      setSelectedDatabase('')
      setSelectedTable('')
      setTableSchema({ columns: [] })
      setMappedColumns([])
    }
    lastConnectionRef.current = currentConnectionId
  }, [clickhouseConnection])

  // Sync table schema from store when storeSchema updates
  useEffect(() => {
    if (storeSchema && storeSchema.length > 0) {
      const filteredSchema = filterUserMappableColumns(storeSchema)
      const schemaChanged =
        tableSchema.columns.length !== filteredSchema.length ||
        !tableSchema.columns.every(
          (col, index) =>
            col.name === filteredSchema[index]?.name &&
            (col.type === filteredSchema[index]?.type || col.type === filteredSchema[index]?.column_type) &&
            col.isNullable === filteredSchema[index]?.isNullable,
        )
      if (!schemaChanged) return

      const hasExistingMappings = mappedColumns.some((col) => col.eventField)
      const shouldKeepExistingMapping = hasExistingMappings && mappedColumns.length > 0
      const newMapping = shouldKeepExistingMapping
        ? filteredSchema.map((col) => {
            const existingCol = mappedColumns.find((mc) => mc.name === col.name)
            if (existingCol) {
              return {
                ...col,
                jsonType: existingCol.jsonType || '',
                isNullable: existingCol.isNullable || false,
                isKey: existingCol.isKey || false,
                eventField: existingCol.eventField || '',
                ...(existingCol.sourceTopic && { sourceTopic: existingCol.sourceTopic }),
              }
            }
            return { ...col, jsonType: '', isNullable: false, isKey: false, eventField: '' }
          })
        : filteredSchema.map((col) => ({
            ...col,
            jsonType: '',
            isNullable: false,
            isKey: false,
            eventField: '',
          }))

      setTableSchema({ columns: filteredSchema })
      setMappedColumns(newMapping)
      updateClickhouseDestinationDraft({ destinationColumns: filteredSchema, mapping: newMapping })
    }
  }, [storeSchema, tableSchema.columns, mappedColumns, updateClickhouseDestinationDraft])

  // Hydration from clickhouseDestination (run once when not hydrated)
  useEffect(() => {
    if (clickhouseDestination && !isHydrated) {
      setSelectedDatabase(clickhouseDestination.database || '')
      setSelectedTable(clickhouseDestination.table || '')
      setTableSchema({ columns: clickhouseDestination.destinationColumns || [] })

      const hasMapping = clickhouseDestination.mapping && clickhouseDestination.mapping.length > 0
      const hasColumns =
        clickhouseDestination.destinationColumns && clickhouseDestination.destinationColumns.length > 0

      if (!hasMapping && hasColumns) {
        const filteredSchema = filterUserMappableColumns(clickhouseDestination.destinationColumns)
        const initialMapping = filteredSchema.map((col) => ({
          ...col,
          jsonType: '',
          isNullable: col.isNullable || false,
          isKey: false,
          eventField: '',
        }))
        setMappedColumns(initialMapping)
      } else {
        setMappedColumns(clickhouseDestination.mapping || [])
      }

      setMaxBatchSize(clickhouseDestination.maxBatchSize || 1000)
      setMaxDelayTime(clickhouseDestination.maxDelayTime || 1)
      setMaxDelayTimeUnit(clickhouseDestination.maxDelayTimeUnit || 'm')
      setIsHydrated(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit clickhouseDestination to prevent resetting user changes
  }, [isHydrated])

  // Load table schema when database and table are selected
  useEffect(() => {
    if (!selectedDatabase || !selectedTable) return
    const schemaFromStore = getTableSchema(selectedDatabase, selectedTable)
    if (schemaFromStore.length > 0) return
    if (
      clickhouseDestination?.destinationColumns?.length > 0 &&
      clickhouseDestination.database === selectedDatabase &&
      clickhouseDestination.table === selectedTable
    ) {
      return
    }
    fetchTableSchema()
  }, [selectedDatabase, selectedTable, getTableSchema, clickhouseDestination, fetchTableSchema])

  // Load databases on mount when connection is ready
  useEffect(() => {
    if (databases.length > 0) return
    const hasConnectionDetails =
      clickhouseConnection.directConnection.host && clickhouseConnection.directConnection.httpPort
    if (connectionStatus === 'success' || hasConnectionDetails) {
      fetchDatabases()
    }
  }, [
    connectionStatus,
    databases.length,
    clickhouseConnection.directConnection.host,
    clickhouseConnection.directConnection.httpPort,
    fetchDatabases,
  ])

  // Load tables when selectedDatabase is set
  useEffect(() => {
    if (!selectedDatabase) return
    fetchTables()
  }, [selectedDatabase, fetchTables])

  const getConnectionConfig = useCallback(
    (): ConnectionConfig => ({
      ...clickhouseConnection.directConnection,
      connectionType: 'direct',
    }),
    [clickhouseConnection.directConnection],
  )

  const testDatabaseAccessWrapper = useCallback(
    async (connectionConfig: ConnectionConfig) => {
      if (!connectionConfig.database) {
        return { success: false, error: 'No database specified' }
      }
      const result = await testDatabaseAccess({
        host: connectionConfig.host,
        httpPort: connectionConfig.httpPort,
        username: connectionConfig.username,
        password: connectionConfig.password,
        database: connectionConfig.database,
        useSSL: connectionConfig.useSSL,
        connectionType: connectionConfig.connectionType,
      })
      return { success: result.success, error: result.error }
    },
    [testDatabaseAccess],
  )

  const testTableAccessWrapper = useCallback(
    async (connectionConfig: ConnectionConfig) => {
      if (!connectionConfig.database || !selectedTable) {
        return { success: false, error: 'No database or table specified' }
      }
      const result = await testTableAccess({
        host: connectionConfig.host,
        httpPort: connectionConfig.httpPort,
        username: connectionConfig.username,
        password: connectionConfig.password,
        database: connectionConfig.database,
        table: selectedTable,
        useSSL: connectionConfig.useSSL,
        connectionType: connectionConfig.connectionType,
      })
      return { success: result.success, error: result.error }
    },
    [testTableAccess, selectedTable],
  )

  const handleDatabaseSelection = useCallback(
    (database: string) => {
      setSelectedDatabase(database)
      setSelectedTable('')
      setTableSchema({ columns: [] })
      setMappedColumns([])
      updateClickhouseDestinationDraft({
        database,
        table: '',
        destinationColumns: [],
        mapping: [],
      })
    },
    [updateClickhouseDestinationDraft],
  )

  const handleTableSelection = useCallback(
    (table: string) => {
      if (selectedTable === table) return
      setSelectedTable(table)
      setTableSchema({ columns: [] })
      setMappedColumns([])
      updateClickhouseDestinationDraft({
        table,
        destinationColumns: [],
        mapping: [],
      })
    },
    [selectedTable, updateClickhouseDestinationDraft],
  )

  const updateColumnMapping = useCallback(
    (index: number, field: keyof TableColumn, value: unknown) => {
      const updatedColumns = [...mappedColumns]
      updatedColumns[index] = { ...updatedColumns[index], [field]: value }
      setMappedColumns(updatedColumns)
      setClickhouseDestination({
        ...(clickhouseDestination ?? {}),
        mapping: updatedColumns,
      } as any)
    },
    [mappedColumns, clickhouseDestination, setClickhouseDestination],
  )

  const handleRefreshDatabases = useCallback(async () => {
    await fetchDatabases()
    if (selectedDatabase && databases.length > 0 && !databases.includes(selectedDatabase)) {
      setSelectedDatabase('')
      setSelectedTable('')
      setTableSchema({ columns: [] })
      setMappedColumns([])
    }
  }, [fetchDatabases, selectedDatabase, databases])

  const handleRefreshTables = useCallback(async () => {
    await fetchTables()
    if (selectedTable && availableTables.length > 0 && !availableTables.includes(selectedTable)) {
      setSelectedTable('')
      setTableSchema({ columns: [] })
      setMappedColumns([])
    }
  }, [fetchTables, selectedTable, availableTables])

  const handleRefreshTableSchema = useCallback(async () => {
    await fetchTableSchema()
  }, [fetchTableSchema])

  return {
    // State
    selectedDatabase,
    setSelectedDatabase,
    selectedTable,
    setSelectedTable,
    tableSchema,
    setTableSchema,
    mappedColumns,
    setMappedColumns,
    maxBatchSize,
    setMaxBatchSize,
    maxDelayTime,
    setMaxDelayTime,
    maxDelayTimeUnit,
    setMaxDelayTimeUnit,
    isHydrated,
    // Refs (for save/completeConfigSave that need current values in callbacks)
    maxDelayTimeRef,
    maxDelayTimeUnitRef,
    maxBatchSizeRef,
    // Data from hooks
    databases,
    availableTables,
    storeSchema,
    // Loading and errors
    isLoading,
    databasesLoading,
    tablesLoading,
    schemaLoading,
    dataError,
    databasesError,
    tablesError,
    schemaError,
    // Handlers
    getConnectionConfig,
    handleDatabaseSelection,
    handleTableSelection,
    updateColumnMapping,
    handleRefreshDatabases,
    handleRefreshTables,
    handleRefreshTableSchema,
    testDatabaseAccessWrapper,
    testTableAccessWrapper,
    // For table schema fetch (same hook instance as used in effects)
    fetchTableSchema,
  }
}
