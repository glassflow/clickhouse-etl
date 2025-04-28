'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { useAnalytics } from '@/src/hooks/useAnalytics'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection } from '@/src/hooks/clickhouse-mng-hooks'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { InfoModal, ModalResult } from '@/src/components/Modal'
import { FieldColumnMapper } from './FieldColumnMapper'
import { useFetchTableSchema } from './hooks'
import {
  extractEventFields,
  inferJsonType,
  findBestMatchingField,
  getNestedValue,
  validateColumnMappings,
  isTypeCompatible,
} from './helpers'
import { TableColumn, TableSchema, DatabaseAccessTestFn, TableAccessTestFn, ConnectionConfig } from './types'
import { DatabaseTableSelectContainer } from './DatabaseTableSelectContainer'
import { BatchDelaySelector } from './BatchDelaySelector'
// import { TypeCompatibilityInfo } from './TypeCompatibilityInfo'

export function ClickhouseJoinMapper({
  onNext,
  primaryIndex = 0,
  secondaryIndex = 1,
}: {
  onNext: (step: StepKeys) => void
  primaryIndex: number
  secondaryIndex: number
}) {
  const { clickhouseStore, topicsStore } = useStore()
  const { trackFunnelStep } = useAnalytics()
  const {
    clickhouseConnection,
    clickhouseDestination,
    setClickhouseDestination,
    availableDatabases,
    setAvailableDatabases,
  } = clickhouseStore

  const { connectionStatus } = clickhouseConnection

  // Get topics data
  const primaryTopic = topicsStore.getTopic(primaryIndex)
  const secondaryTopic = topicsStore.getTopic(secondaryIndex)

  // Add tracking refs to avoid re-renders and prevent infinite loops
  const viewTrackedRef = useRef(false)
  const completionTrackedRef = useRef(false)

  // Initialize state
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
  const [maxDelayTime, setMaxDelayTime] = useState(clickhouseDestination?.maxDelayTime || 1000)
  const [maxDelayTimeUnit, setMaxDelayTimeUnit] = useState(clickhouseDestination?.maxDelayTimeUnit || 'm')
  const [eventFields, setEventFields] = useState<string[]>([])
  const [primaryEventData, setPrimaryEventData] = useState<any>(primaryTopic?.selectedEvent?.event?.event || null)
  const [secondaryEventData, setSecondaryEventData] = useState<any>(secondaryTopic?.selectedEvent?.event?.event || null)

  // Update validation state to include type incompatibilities
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

  // Replace individual modal states with a single modal state object
  const [modalProps, setModalProps] = useState({
    visible: false,
    message: '',
    title: '',
    okButtonText: 'Yes',
    cancelButtonText: 'No',
    type: 'info' as 'info' | 'warning' | 'error',
  })

  // Extract fields from both topics' events
  const [primaryEventFields, setPrimaryEventFields] = useState<string[]>([])
  const [secondaryEventFields, setSecondaryEventFields] = useState<string[]>([])

  const [pendingAction, setPendingAction] = useState<'none' | 'save'>('none')

  // Track previous connection to detect changes
  const connectionRef = useRef<string>('')

  // Add effect to reset state when connection changes
  useEffect(() => {
    // Create a connection identifier string
    const currentConnectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.port}:${clickhouseConnection.directConnection.username}`

    // If we have a previous connection and it's different, reset state
    if (connectionRef.current && connectionRef.current !== currentConnectionId) {
      // Reset local state
      setSelectedDatabase('')
      setSelectedTable('')
      setAvailableTables([])
      setTableSchema({ columns: [] })
      setMappedColumns([])

      // Track the connection change event
      trackFunnelStep('connectionChanged', {
        component: 'ClickhouseJoinMapper',
        primaryTopicName: primaryTopic?.name,
        secondaryTopicName: secondaryTopic?.name,
      })
    }

    // Update reference with current connection
    connectionRef.current = currentConnectionId
  }, [clickhouseConnection, trackFunnelStep, primaryTopic?.name, secondaryTopic?.name])

  // Basic page view tracking, only track once on component mount
  useEffect(() => {
    if (!viewTrackedRef.current) {
      trackFunnelStep('clickhouseJoinMapperView', {
        primaryTopicName: primaryTopic?.name,
        secondaryTopicName: secondaryTopic?.name,
      })
      viewTrackedRef.current = true
    }
  }, [trackFunnelStep, primaryTopic?.name, secondaryTopic?.name])

  // Get connection config
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

  // Add effect for extracting fields from primary event
  useEffect(() => {
    if (primaryEventData) {
      const fields = extractEventFields(primaryEventData)
      setPrimaryEventFields(fields)
      setEventFields([...fields]) // Initialize with primary fields
    }
  }, [primaryEventData])

  // Add effect for extracting fields from secondary event
  useEffect(() => {
    if (secondaryEventData) {
      const fields = extractEventFields(secondaryEventData)
      setSecondaryEventFields(fields)
      setEventFields((prev) => [...prev, ...fields]) // Add secondary fields
    }
  }, [secondaryEventData])

  // Update effect for handling event data changes to handle nested structure
  useEffect(() => {
    if (primaryTopic?.selectedEvent?.event?.event) {
      setPrimaryEventData(primaryTopic.selectedEvent.event.event)
    }
    if (secondaryTopic?.selectedEvent?.event?.event) {
      setSecondaryEventData(secondaryTopic.selectedEvent.event.event)
    }
  }, [primaryTopic?.selectedEvent?.event?.event, secondaryTopic?.selectedEvent?.event?.event])

  // NOTE: uncomment this when you want to auto-map the fields
  // Update auto-mapping effect to handle nested structure
  // useEffect(() => {
  //   if (tableSchema.columns.length > 0 && (primaryEventFields.length > 0 || secondaryEventFields.length > 0)) {
  //     const updatedColumns = tableSchema.columns.map((column) => {
  //       let bestMatch = findBestMatchingField(column.name, primaryEventFields)
  //       let source: 'primary' | 'secondary' = 'primary'
  //       let eventData = primaryTopic?.selectedEvent?.event?.event

  //       if (!bestMatch) {
  //         bestMatch = findBestMatchingField(column.name, secondaryEventFields)
  //         source = 'secondary'
  //         eventData = secondaryTopic?.selectedEvent?.event?.event
  //       }

  //       if (bestMatch) {
  //         const value = eventData ? getNestedValue(eventData, bestMatch) : undefined
  //         const inferredType = inferJsonType(value)

  //         return {
  //           ...column,
  //           eventField: bestMatch,
  //           jsonType: inferredType,
  //         }
  //       }

  //       return column
  //     })

  //     setMappedColumns(updatedColumns)
  //   }
  // }, [tableSchema.columns, primaryEventFields, secondaryEventFields])

  // Add this effect hook to fetch tables when database is selected
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

  // Add column mapping functions
  const updateColumnMapping = (index: number, field: keyof TableColumn, value: any) => {
    const updatedColumns = [...mappedColumns]
    updatedColumns[index] = {
      ...updatedColumns[index],
      [field]: value,
    }
    setMappedColumns(updatedColumns)
  }

  // Update mapEventFieldToColumn to validate and infer types correctly
  const mapEventFieldToColumn = (index: number, eventField: string, source?: 'primary' | 'secondary') => {
    const updatedColumns = [...mappedColumns]
    const eventData =
      source === 'secondary' ? secondaryTopic?.selectedEvent?.event?.event : primaryTopic?.selectedEvent?.event?.event

    // Get the value from the event data to infer the type
    const value = eventData ? getNestedValue(eventData, eventField) : undefined
    let inferredType = inferJsonType(value)

    // Ensure we have a type - default to string if we couldn't infer a type from the data
    if (!inferredType && eventField) {
      inferredType = 'string'
      console.log(`Warning: Couldn't infer type for ${eventField}, defaulting to string`)
    }

    // Check type compatibility immediately
    const isCompatible = isTypeCompatible(inferredType, updatedColumns[index].type)

    // Determine which topic this field belongs to
    const topicName = source === 'secondary' ? secondaryTopic?.name : primaryTopic?.name

    updatedColumns[index] = {
      ...updatedColumns[index],
      eventField,
      jsonType: inferredType,
      sourceTopic: topicName, // Add the source topic name to the mapping
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

  // Update validation logic
  const validateMapping = (): ValidationResult | null => {
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
    const allEventFields = [...primaryEventFields, ...secondaryEventFields]
    const extraFields = allEventFields.filter((field) => !mappedColumns.some((col) => col.eventField === field))
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

  const completeConfigSave = () => {
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

    // Track completion once when the form is successfully saved
    if (!completionTrackedRef.current) {
      trackFunnelStep('clickhouseJoinMapperCompleted', {
        primaryTopicName: primaryTopic?.name,
        secondaryTopicName: secondaryTopic?.name,
        database: selectedDatabase,
        table: selectedTable,
      })
      completionTrackedRef.current = true
    }

    // Save the configuration
    setClickhouseDestination({
      database: selectedDatabase,
      table: selectedTable,
      destinationColumns: tableSchema.columns,
      mapping: mappedColumns,
      scheme: '',
      maxBatchSize: maxBatchSize || 1000,
      maxDelayTime: maxDelayTime || 1000,
      maxDelayTimeUnit: maxDelayTimeUnit || 'm',
      // useSSL: clickhouseConnection.directConnection.useSSL || true,
    })

    setSuccess('Destination configuration saved successfully!')
    setTimeout(() => setSuccess(null), 3000)

    // Move to next step
    onNext(StepKeys.CLICKHOUSE_MAPPER)
  }

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

        {/* Column Mapping */}
        {selectedTable && tableSchema.columns.length > 0 && (
          <>
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
                eventFields={[...primaryEventFields, ...secondaryEventFields]}
                mappedColumns={mappedColumns}
                updateColumnMapping={updateColumnMapping}
                mapEventFieldToColumn={mapEventFieldToColumn}
                primaryEventFields={primaryEventFields}
                secondaryEventFields={secondaryEventFields}
                primaryTopicName={primaryTopic?.name}
                secondaryTopicName={secondaryTopic?.name}
                isJoinMapping={true}
              />
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
          </>
        )}

        {/* Success/Error Messages */}
        {/* {success && (
          <div className="p-3 bg-background-neutral-faded text-green-700 rounded-md flex items-center">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            <span>{success}</span>
          </div>
        )} */}

        {error && (
          <div className="p-3 bg-background-neutral-faded text-red-700 rounded-md flex items-center">
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

      {/* TypeCompatibilityInfo is temporarily hidden */}
      {/* <TypeCompatibilityInfo /> */}
    </div>
  )
}
