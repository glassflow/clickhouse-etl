import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection } from '@/src/hooks/clickhouse-mng-hooks'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { InfoModal, ModalResult } from '@/src/components/common/Modal'
import { FieldColumnMapper } from './components/FieldColumnMapper'
import { useFetchTableSchema } from './hooks'
import {
  extractEventFields,
  inferJsonType,
  findBestMatchingField,
  getNestedValue,
  validateColumnMappings,
  isTypeCompatible,
  getMappingType,
} from './helpers'
import { TableColumn, TableSchema, DatabaseAccessTestFn, TableAccessTestFn } from './types'
import { DatabaseTableSelectContainer } from './components/DatabaseTableSelectContainer'
import { BatchDelaySelector } from './components/BatchDelaySelector'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { generateApiConfig } from './helpers'

export function ClickhouseMapper({ onNext, index = 0 }: { onNext: (step: StepKeys) => void; index: number }) {
  const router = useRouter()
  const {
    clickhouseStore,
    kafkaStore,
    joinStore,
    topicsStore,
    setApiConfig,
    pipelineId,
    setPipelineId,
    operationsSelected,
  } = useStore()
  const analytics = useJourneyAnalytics()
  const {
    clickhouseConnection,
    clickhouseDestination,
    setClickhouseDestination,
    availableDatabases,
    setAvailableDatabases,
  } = clickhouseStore

  const { connectionStatus, connectionError, connectionType } = clickhouseConnection
  const { getTopic } = topicsStore

  const selectedTopic = getTopic(index)
  const selectedEvent = selectedTopic?.selectedEvent
  const topicEvents = selectedTopic?.events
  const topicName = selectedTopic?.name

  // Analytics tracking states
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const [hasTrackedDatabaseSelection, setHasTrackedDatabaseSelection] = useState(false)
  const [hasTrackedTableSelection, setHasTrackedTableSelection] = useState(false)
  const [hasTrackedFieldMapping, setHasTrackedFieldMapping] = useState(false)
  const [prevMappedFieldsCount, setPrevMappedFieldsCount] = useState(0)

  // Initialize state from store values
  const [selectedDatabase, setSelectedDatabase] = useState<string>(clickhouseDestination?.database || '')
  const [selectedTable, setSelectedTable] = useState<string>(clickhouseDestination?.table || '')
  const [availableTables, setAvailableTables] = useState<string[]>([])
  const [tableSchema, setTableSchema] = useState<TableSchema>({
    columns: clickhouseDestination?.destinationColumns || [],
  })
  const [mappedColumns, setMappedColumns] = useState<TableColumn[]>(clickhouseDestination?.mapping || [])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [maxBatchSize, setMaxBatchSize] = useState(clickhouseDestination?.maxBatchSize || 1000)
  const [maxDelayTime, setMaxDelayTime] = useState(clickhouseDestination?.maxDelayTime || 1)
  const [maxDelayTimeUnit, setMaxDelayTimeUnit] = useState(clickhouseDestination?.maxDelayTimeUnit || 'm')

  const [eventFields, setEventFields] = useState<string[]>([])
  const [eventData, setEventData] = useState<any>(selectedEvent?.event || null)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [modalTitle, setModalTitle] = useState('')
  const [validationIssues, setValidationIssues] = useState<{
    unmappedNullableColumns: string[]
    unmappedNonNullableColumns: string[]
    extraEventFields: string[]
    incompatibleTypeMappings: any[]
    missingTypeMappings: any[]
  }>({
    unmappedNullableColumns: [],
    unmappedNonNullableColumns: [],
    extraEventFields: [],
    incompatibleTypeMappings: [],
    missingTypeMappings: [],
  })
  // Add these state variables to track what action to take after validation
  const [pendingAction, setPendingAction] = useState<'none' | 'save'>('none')

  const selectedTopics = Object.values(topicsStore.topics || {})

  // Replace individual modal states with a single modal state object
  const [modalProps, setModalProps] = useState({
    visible: false,
    message: '',
    title: '',
    okButtonText: 'Yes',
    cancelButtonText: 'No',
    type: 'info' as 'info' | 'warning' | 'error',
  })

  // Add a ref to track the last connection we loaded data for
  const lastConnectionRef = useRef<string>('')

  // Reset UI state when the connection changes
  // This ensures the UI reflects the current connection data
  useEffect(() => {
    // Create a connection identifier string to detect changes
    const currentConnectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.port}:${clickhouseConnection.directConnection.username}`

    // Check if connection has changed since we last loaded data
    if (lastConnectionRef.current && lastConnectionRef.current !== currentConnectionId) {
      // Connection changed, reset local state
      setSelectedDatabase('')
      setSelectedTable('')
      setAvailableTables([])
      setTableSchema({ columns: [] })
      setMappedColumns([])
    }

    // Update the connection reference
    lastConnectionRef.current = currentConnectionId
  }, [clickhouseConnection, topicName, index])

  // Track initial view
  useEffect(() => {
    if (!hasTrackedView) {
      analytics.page.selectDestination({
        topicName,
        topicIndex: index,
        isReturningVisit: !!clickhouseDestination?.database,
        existingMappingCount: clickhouseDestination?.mapping?.length || 0,
      })
      setHasTrackedView(true)
    }
  }, [hasTrackedView, analytics.page, topicName, index, clickhouseDestination])

  // Get connection config based on connection type
  const getConnectionConfig = () => ({
    ...clickhouseConnection.directConnection,
    connectionType: 'direct' as const,
  })

  const { testDatabaseAccess, testTableAccess } = useClickhouseConnection()
  const { fetchTableSchema } = useFetchTableSchema({
    selectedDatabase,
    selectedTable,
    setTableSchema,
    setIsLoading,
    setError,
    getConnectionConfig,
    setMappedColumns,
    setSuccess,
  })

  // Enhanced database selection handler with tracking
  const handleDatabaseSelection = useCallback(
    (database: string) => {
      setSelectedDatabase(database)

      // Track database selection if it's the first time
      if (!hasTrackedDatabaseSelection || clickhouseDestination?.database !== database) {
        analytics.destination.databaseSelected({
          database,
          topicName,
          topicIndex: index,
          isChange: !!clickhouseDestination?.database && clickhouseDestination.database !== database,
        })
        setHasTrackedDatabaseSelection(true)
      }
    },
    [hasTrackedDatabaseSelection, clickhouseDestination, analytics.destination, topicName, index],
  )

  // Enhanced table selection handler with tracking
  const handleTableSelection = useCallback(
    (table: string) => {
      setSelectedTable(table)

      // Track table selection if it's the first time or a change
      if (!hasTrackedTableSelection || clickhouseDestination?.table !== table) {
        analytics.destination.tableSelected({
          database: selectedDatabase,
          table,
          topicName,
          topicIndex: index,
          isChange: !!clickhouseDestination?.table && clickhouseDestination.table !== table,
        })
        setHasTrackedTableSelection(true)
      }
    },
    [hasTrackedTableSelection, clickhouseDestination, selectedDatabase, analytics.destination, topicName, index],
  )

  // Sync component with store when clickhouseDestination changes
  useEffect(() => {
    if (clickhouseDestination) {
      // Update database selection
      if (clickhouseDestination.database && clickhouseDestination.database !== selectedDatabase) {
        setSelectedDatabase(clickhouseDestination.database)
      }

      // Update table selection
      if (clickhouseDestination.table && clickhouseDestination.table !== selectedTable) {
        setSelectedTable(clickhouseDestination.table)
      }

      // Update table schema if available
      if (clickhouseDestination.destinationColumns?.length > 0) {
        setTableSchema({ columns: clickhouseDestination.destinationColumns })
      }

      // Update mapped columns if available
      if (clickhouseDestination.mapping?.length > 0) {
        setMappedColumns(clickhouseDestination.mapping)
      }
    }
  }, [clickhouseDestination])

  // Load table schema when database and table are selected
  useEffect(() => {
    if (selectedDatabase && selectedTable) {
      // If we already have schema data in the store, use that
      if (
        clickhouseDestination?.destinationColumns?.length > 0 &&
        clickhouseDestination.database === selectedDatabase &&
        clickhouseDestination.table === selectedTable
      ) {
        setTableSchema({ columns: clickhouseDestination.destinationColumns })

        // If we also have mapping data, use that
        if (clickhouseDestination.mapping?.length > 0) {
          setMappedColumns(clickhouseDestination.mapping)
        } else {
          // Otherwise create default mapping
          const defaultMapping = clickhouseDestination.destinationColumns.map((col) => ({
            ...col,
            jsonType: '',
            isNullable: false,
            isKey: false,
            eventField: '',
          }))
          setMappedColumns(defaultMapping)
        }
      } else {
        // Now this reference is valid
        fetchTableSchema()
      }
    }
  }, [selectedDatabase, selectedTable])

  // Load event fields when event data changes
  useEffect(() => {
    if (selectedEvent && topicEvents && topicEvents.length > 0) {
      // The structure has changed - selectedEvent is now an object with event property
      // We don't need to search in topicEvents anymore
      const eventData = selectedEvent?.event

      if (eventData) {
        setEventData(eventData)

        // Extract fields from event data
        const fields = extractEventFields(eventData)
        setEventFields(fields)

        // Try to auto-map fields if we have mapping data
        if (clickhouseDestination?.mapping?.length > 0) {
          // Mapping already exists, keep it
          setMappedColumns(clickhouseDestination.mapping)
        } else if (mappedColumns.length > 0 && fields.length > 0) {
          // Try to auto-map based on field names
          const updatedColumns = [...mappedColumns]
          updatedColumns.forEach((col, index) => {
            // Try to find a matching field by name similarity
            const matchingField = findBestMatchingField(col.name, fields)
            if (matchingField) {
              updatedColumns[index] = {
                ...col,
                eventField: matchingField,
                jsonType: inferJsonType(getNestedValue(eventData, matchingField)),
              }
            }
          })
          setMappedColumns(updatedColumns)

          // Track auto-mapping success (only track once when it happens)
          const autoMappedCount = updatedColumns.filter((col) => col.eventField).length
        }
      } else {
        console.log('No event data found')
      }
    }
  }, [selectedEvent, topicEvents])

  // Track field mapping changes
  useEffect(() => {
    const mappedFieldsCount = mappedColumns.filter((col) => col.eventField).length

    // Only track if there's a real change in field mapping count
    if (mappedFieldsCount > 0 && mappedFieldsCount !== prevMappedFieldsCount) {
      setPrevMappedFieldsCount(mappedFieldsCount)

      // Don't track the first time when we're just initializing from store
      if (prevMappedFieldsCount > 0 || !clickhouseDestination?.mapping?.length) {
        setHasTrackedFieldMapping(true)
      }
    }
  }, [mappedColumns, prevMappedFieldsCount, analytics.destination, topicName, index, clickhouseDestination])

  // Load databases when component mounts, but only if not already loaded
  useEffect(() => {
    if (availableDatabases.length > 0) {
      return
    }

    const fetchDatabases = async () => {
      setIsLoading(true)

      try {
        const response = await fetch('/api/clickhouse/databases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(getConnectionConfig()),
        })

        const data = await response.json()

        if (data.success) {
          setAvailableDatabases(data.databases || [])
          setError(null)

          // Track successful database fetch
          analytics.destination.databasesFetched({
            databaseCount: data.databases?.length || 0,
          })
        } else {
          setError(data.error || 'Failed to fetch databases')

          // Track error
          analytics.destination.databaseFetchedError({
            error: data.error || 'Failed to fetch databases',
          })
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
        setError(errorMessage)

        // Track error
        analytics.destination.databaseFetchedError({
          error: errorMessage,
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (connectionStatus === 'success') {
      fetchDatabases()
    }
  }, [connectionStatus, availableDatabases.length, setAvailableDatabases])

  // Load tables when database is selected
  useEffect(() => {
    if (!selectedDatabase) {
      return
    }

    const fetchTables = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/clickhouse/tables', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...getConnectionConfig(),
            database: selectedDatabase,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setAvailableTables(data.tables || [])
          setError(null)

          // Track tables loaded
          analytics.destination.tablesFetched({
            database: selectedDatabase,
            tableCount: data.tables?.length || 0,
          })
        } else {
          setError(data.error || `Failed to fetch tables for database '${selectedDatabase}'`)

          // Track error
          analytics.destination.tableFetchedError({
            error: data.error || `Failed to fetch tables for database '${selectedDatabase}'`,
            database: selectedDatabase,
          })
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
        setError(errorMessage)

        // Track error
        analytics.destination.tableFetchedError({
          component: 'ClickhouseMapper',
          error: errorMessage,
          database: selectedDatabase,
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchTables()
  }, [selectedDatabase])

  // Update column mapping
  const updateColumnMapping = (index: number, field: keyof TableColumn, value: any) => {
    const updatedColumns = [...mappedColumns]
    updatedColumns[index] = {
      ...updatedColumns[index],
      [field]: value,
    }

    setMappedColumns(updatedColumns)
    setClickhouseDestination({
      ...clickhouseDestination,
      mapping: updatedColumns,
    })
  }

  // Map event field to column
  const mapEventFieldToColumn = (index: number, eventField: string) => {
    const updatedColumns = [...mappedColumns]
    const fieldValue = eventField ? getNestedValue(eventData, eventField) : undefined
    let inferredType = eventField ? inferJsonType(fieldValue) : updatedColumns[index].jsonType

    // Ensure we have a type - default to string if we couldn't infer a type from the data
    if (!inferredType && eventField) {
      inferredType = 'string'
    }

    updatedColumns[index] = {
      ...updatedColumns[index],
      eventField: eventField,
      jsonType: inferredType,
    }

    // Check compatibility immediately for better user feedback
    const isCompatible = isTypeCompatible(inferredType, updatedColumns[index].type)

    setMappedColumns(updatedColumns)
  }

  // Add validation type enum
  type ValidationType = 'error' | 'warning' | 'info'

  // Add validation result type
  type ValidationResult = {
    type: ValidationType
    canProceed: boolean
    message: string
    title: string
    okButtonText: string
    cancelButtonText: string
  }

  // Add validation logic
  const validateMapping = useCallback((): ValidationResult | null => {
    // Reset validation state
    const issues = {
      unmappedNullableColumns: [] as string[],
      unmappedNonNullableColumns: [] as string[],
      extraEventFields: [] as string[],
      incompatibleTypeMappings: [] as any[],
      missingTypeMappings: [] as any[],
    }

    // Count mapped fields
    const mappedFieldsCount = mappedColumns.filter((col) => col.eventField).length
    const totalColumnsCount = tableSchema.columns.length

    // Find unmapped columns
    tableSchema.columns.forEach((column) => {
      const mappedColumn = mappedColumns.find((mc) => mc.name === column.name)
      if (!mappedColumn || !mappedColumn.eventField) {
        // Check if the column is actually nullable by examining its type
        const isActuallyNullable = column.type.includes('Nullable') || column.isNullable === true

        if (isActuallyNullable) {
          issues.unmappedNullableColumns.push(column.name)
        } else {
          issues.unmappedNonNullableColumns.push(column.name)
        }
      }
    })

    // Find extra event fields
    const extraFields = eventFields.filter((field) => !mappedColumns.some((col) => col.eventField === field))
    issues.extraEventFields = extraFields

    // Validate type compatibility
    const { invalidMappings, missingTypeMappings } = validateColumnMappings(mappedColumns)
    issues.incompatibleTypeMappings = invalidMappings
    issues.missingTypeMappings = missingTypeMappings

    setValidationIssues(issues)

    // Check in order of priority:
    // 1. Type compatibility violations (error)
    // 2. Missing type mappings (error)
    // 3. Non-nullable column violations (error)
    // 4. Unmapped nullable columns (warning)
    // 5. Extra event fields (warning)

    if (issues.incompatibleTypeMappings.length > 0) {
      const incompatibleFields = issues.incompatibleTypeMappings
        .map((mapping) => `${mapping.name} (${mapping.jsonType} → ${mapping.type})`)
        .join(', ')

      return {
        type: 'error',
        canProceed: false,
        title: 'Error: Type Incompatibility',
        message: `Some event fields are mapped to incompatible ClickHouse column types. Please review and fix these mappings:
        ${incompatibleFields}`,
        okButtonText: 'OK',
        cancelButtonText: 'Cancel',
      }
    } else if (issues.missingTypeMappings.length > 0) {
      const missingTypeFields = issues.missingTypeMappings
        .map((mapping) => `${mapping.name} (mapped to ${mapping.eventField})`)
        .join(', ')

      return {
        type: 'error',
        canProceed: false,
        title: 'Error: Missing Type Information',
        message: `Some mapped fields have no type information. This might happen when the field path exists but the value is undefined or null. Please review these mappings:
        ${missingTypeFields}`,
        okButtonText: 'OK',
        cancelButtonText: 'Cancel',
      }
    } else if (issues.unmappedNonNullableColumns.length > 0) {
      return {
        type: 'error',
        canProceed: false,
        title: 'Error: Null Constraint Violation',
        message: `Target table has NOT NULL constraints. Either modify table to allow nulls, provide values for all required fields, or set database defaults.
        Required columns: ${issues.unmappedNonNullableColumns.join(', ')}`,
        okButtonText: 'OK',
        cancelButtonText: 'Cancel',
      }
    } else if (mappedFieldsCount < totalColumnsCount && issues.unmappedNullableColumns.length > 0) {
      return {
        type: 'warning',
        canProceed: true,
        title: 'Field Count Mismatch',
        message: `Are you sure you want to deploy this pipeline while event field count (${mappedFieldsCount}) is less than table columns (${totalColumnsCount})? Some columns may not receive data.
        The following columns will be set to NULL: ${issues.unmappedNullableColumns.join(', ')}`,
        okButtonText: 'Continue',
        cancelButtonText: 'Cancel',
      }
    } else if (issues.extraEventFields.length > 0) {
      return {
        type: 'warning',
        canProceed: true,
        title: 'Extra Fields Detected',
        message: `Some incoming event fields will not be mapped to table columns. Unmapped fields will be dropped during processing. Do you want to continue with deployment?
        Unmapped fields: ${issues.extraEventFields.join(', ')}`,
        okButtonText: 'Continue',
        cancelButtonText: 'Cancel',
      }
    }

    return null // No validation issues
  }, [mappedColumns, tableSchema.columns, eventFields, analytics.destination, topicName, index])

  // Add save configuration logic
  const saveDestinationConfig = useCallback(() => {
    // Set the pending action to 'save' so we know what to do after validation
    setPendingAction('save')

    analytics.destination.columnsSelected({
      count: mappedColumns.length,
    })

    // Run validation
    const validationResult = validateMapping()

    if (validationResult) {
      // Show modal with validation result
      setModalProps({
        visible: true,
        title: validationResult.title,
        message: validationResult.message,
        okButtonText: validationResult.okButtonText,
        cancelButtonText: validationResult.cancelButtonText,
        type: validationResult.type,
      })
    } else {
      // No validation issues, proceed directly
      completeConfigSave()
    }
  }, [validateMapping])

  // Complete the save after modal confirmation
  const completeConfigSave = useCallback(() => {
    // Before saving, do a final validation of type compatibility
    const { invalidMappings, missingTypeMappings } = validateColumnMappings(mappedColumns)

    if (invalidMappings.length > 0) {
      const incompatibleFields = invalidMappings
        .map((mapping) => `${mapping.name} (${mapping.jsonType} → ${mapping.type})`)
        .join(', ')

      setError(`Type compatibility issues remain: ${incompatibleFields}. Please fix these before continuing.`)
      return
    }

    if (missingTypeMappings.length > 0) {
      const missingFields = missingTypeMappings
        .map((mapping) => `${mapping.name} (mapped to ${mapping.eventField})`)
        .join(', ')

      setError(`Some mapped fields are missing type information: ${missingFields}. Please review these mappings.`)
      return
    }

    // Calculate mapping stats
    const totalColumns = tableSchema.columns.length
    const mappedColumns2 = mappedColumns.filter((col) => col.eventField).length
    const mappingPercentage = Math.round((mappedColumns2 / totalColumns) * 100)

    // Track successful completion
    analytics.destination.mappingCompleted({
      count: mappedColumns.length,
      totalColumns,
      mappingPercentage,
      batchSize: maxBatchSize,
      delayTime: maxDelayTime,
      delayUnit: maxDelayTimeUnit,
    })

    // Create the updated destination config first
    const updatedDestination = {
      ...clickhouseDestination,
      database: selectedDatabase,
      table: selectedTable,
      mapping: mappedColumns,
      destinationColumns: tableSchema.columns,
      maxBatchSize: maxBatchSize,
      maxDelayTime: maxDelayTime,
      maxDelayTimeUnit: maxDelayTimeUnit,
    }

    // Generate config with the updated destination
    const apiConfig = generateApiConfig({
      pipelineId,
      setPipelineId,
      clickhouseConnection,
      clickhouseDestination: updatedDestination,
      selectedTopics,
      getMappingType,
      joinStore,
      kafkaStore,
    })

    // Update the store with the new destination config
    setClickhouseDestination(updatedDestination)
    setApiConfig(apiConfig)

    setSuccess('Destination configuration saved successfully!')
    setTimeout(() => setSuccess(null), 3000)

    // Navigate to the pipelines page
    router.push('/pipelines')
  }, [
    clickhouseDestination,
    selectedDatabase,
    selectedTable,
    mappedColumns,
    tableSchema.columns,
    maxBatchSize,
    maxDelayTime,
    maxDelayTimeUnit,
    pipelineId,
    setPipelineId,
    clickhouseConnection,
    selectedTopics,
    joinStore,
    kafkaStore,
    setClickhouseDestination,
    setApiConfig,
    router,
    analytics.destination,
  ])

  // Add this useEffect to clean up modal state
  useEffect(() => {
    return () => {
      // Clean up modal state when component unmounts
      setShowWarningModal(false)
      setShowErrorModal(false)
      setShowInfoModal(false)
    }
  }, [])

  return (
    <div className="flex flex-col gap-8 mb-4">
      <div className="space-y-6">
        <DatabaseTableSelectContainer
          availableDatabases={availableDatabases}
          selectedDatabase={selectedDatabase}
          setSelectedDatabase={handleDatabaseSelection}
          testDatabaseAccess={testDatabaseAccess as DatabaseAccessTestFn}
          isLoading={isLoading}
          getConnectionConfig={getConnectionConfig}
          availableTables={availableTables}
          selectedTable={selectedTable}
          setSelectedTable={handleTableSelection}
          testTableAccess={testTableAccess as TableAccessTestFn}
        />

        {/* Batch Size / Delay Time / Column Mapping */}
        {selectedTable && tableSchema.columns.length > 0 && (
          <div className="transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
            <BatchDelaySelector
              maxBatchSize={maxBatchSize}
              maxDelayTime={maxDelayTime}
              maxDelayTimeUnit={maxDelayTimeUnit}
              onMaxBatchSizeChange={setMaxBatchSize}
              onMaxDelayTimeChange={setMaxDelayTime}
              onMaxDelayTimeUnitChange={setMaxDelayTimeUnit}
            />
            <FieldColumnMapper
              eventFields={eventFields}
              mappedColumns={mappedColumns}
              updateColumnMapping={updateColumnMapping}
              mapEventFieldToColumn={mapEventFieldToColumn}
            />
            {/* TypeCompatibilityInfo is temporarily hidden */}
            {/* <TypeCompatibilityInfo /> */}
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className={cn({
                  'btn-primary': true,
                  'btn-text': true,
                  'opacity-50': isLoading,
                })}
                size="sm"
                onClick={saveDestinationConfig}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {/* {success && (
          <div className="p-3 bg-background-neutral-faded text-green-700 rounded-md flex items-center border border-[var(--color-border-neutral)]">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            <span>{success}</span>
          </div>
        )} */}

        {error && (
          <div className="p-3 bg-background-neutral-faded text-red-700 rounded-md flex items-center border border-[var(--color-border-neutral)]">
            <XCircleIcon className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <InfoModal
        visible={modalProps.visible}
        title={modalProps.title}
        description={modalProps.message}
        okButtonText={modalProps.okButtonText}
        cancelButtonText={modalProps.cancelButtonText}
        onComplete={(result) => {
          setModalProps((prev) => ({ ...prev, visible: false }))
          if (result === ModalResult.YES) {
            if (modalProps.type === 'error') {
              // For errors, we don't proceed even if user confirms
              setError('Please fix the validation errors before proceeding.')
            } else {
              // For warnings, we proceed if user confirms
              completeConfigSave()
            }
          }
          setPendingAction('none')
        }}
        pendingOperation={pendingAction}
      />
    </div>
  )
}
