import { useState, useEffect } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection } from '@/src/hooks/clickhouse-mng-hooks'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { InfoModal, ModalResult } from '@/src/components/Modal'
import { FieldColumnMapper } from './FieldColumnMapper'
import { useFetchTableSchema } from './hooks'
import { extractEventFields, inferJsonType, findBestMatchingField, getNestedValue } from './helpers'
import { TableColumn, TableSchema, DatabaseAccessTestFn, TableAccessTestFn, ConnectionConfig } from './types'
import { DatabaseTableSelectContainer } from './DatabaseTableSelectContainer'
import { BatchDelaySelector } from './BatchDelaySelector'

export function ClickhouseMapper({ onNext, index = 0 }: { onNext: (step: StepKeys) => void; index: number }) {
  const { clickhouseStore, kafkaStore, operationsSelected } = useStore()
  const {
    clickhouseConnection,
    clickhouseDestination,
    setClickhouseDestination,
    availableDatabases,
    setAvailableDatabases,
  } = clickhouseStore

  const { connectionStatus, connectionError, connectionType } = clickhouseConnection

  const { topicsStore } = useStore()
  const { getTopic } = topicsStore

  const selectedTopic = getTopic(index)
  const selectedEvent = selectedTopic?.selectedEvent
  const topicEvents = selectedTopic?.events
  const topicName = selectedTopic?.name

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
  }>({
    unmappedNullableColumns: [],
    unmappedNonNullableColumns: [],
    extraEventFields: [],
  })
  // Add these state variables to track what action to take after validation
  const [pendingAction, setPendingAction] = useState<'none' | 'save'>('none')

  // Replace individual modal states with a single modal state object
  const [modalProps, setModalProps] = useState({
    visible: false,
    message: '',
    title: '',
    okButtonText: 'Yes',
    cancelButtonText: 'No',
    type: 'info' as 'info' | 'warning' | 'error',
  })

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
      const eventData = selectedEvent.event?.event

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
        }
      } else {
        console.log('No event data found')
      }
    }
  }, [selectedEvent, topicEvents])

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
        } else {
          setError(data.error || 'Failed to fetch databases')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
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
        } else {
          setError(data.error || `Failed to fetch tables for database '${selectedDatabase}'`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
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
    updatedColumns[index] = {
      ...updatedColumns[index],
      eventField: eventField,
      // If the field exists in the event data, try to infer the type
      jsonType: eventField ? typeof getNestedValue(eventData, eventField) : updatedColumns[index].jsonType,
    }
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
  const validateMapping = (): ValidationResult | null => {
    // Reset validation state
    const issues = {
      unmappedNullableColumns: [] as string[],
      unmappedNonNullableColumns: [] as string[],
      extraEventFields: [] as string[],
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

    setValidationIssues(issues)

    // Check in order of priority:
    // 1. Non-nullable column violations (error)
    // 2. Unmapped nullable columns (warning)
    // 3. Extra event fields (warning)

    if (issues.unmappedNonNullableColumns.length > 0) {
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
  }

  // Add save configuration logic
  const saveDestinationConfig = () => {
    // Set the pending action to 'save' so we know what to do after validation
    setPendingAction('save')

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
  }

  // Complete the save after modal confirmation
  const completeConfigSave = () => {
    setClickhouseDestination({
      ...clickhouseDestination,
      database: selectedDatabase,
      table: selectedTable,
      mapping: mappedColumns,
      destinationColumns: tableSchema.columns,
      maxBatchSize: maxBatchSize,
      maxDelayTime: maxDelayTime,
      maxDelayTimeUnit: maxDelayTimeUnit,
    })

    setSuccess('Destination configuration saved successfully!')
    setTimeout(() => setSuccess(null), 3000)

    if (onNext) {
      onNext(StepKeys.CLICKHOUSE_MAPPER)
    }
  }

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
    <div className="flex flex-col gap-8">
      <div className="space-y-6">
        <DatabaseTableSelectContainer
          availableDatabases={availableDatabases}
          selectedDatabase={selectedDatabase}
          setSelectedDatabase={setSelectedDatabase}
          testDatabaseAccess={testDatabaseAccess as DatabaseAccessTestFn}
          isLoading={isLoading}
          getConnectionConfig={getConnectionConfig}
          availableTables={availableTables}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
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
            <div className="flex gap-2">
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
        {success && (
          <div className="p-3 bg-background-neutral-faded text-green-700 rounded-md flex items-center border border-[var(--color-border-neutral)]">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            <span>{success}</span>
          </div>
        )}

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
