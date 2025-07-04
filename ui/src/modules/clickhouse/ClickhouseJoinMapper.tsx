'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection, useClickhouseDatabases, useClickhouseTables, useClickhouseTableSchema } from './hooks'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { InfoModal, ModalResult } from '@/src/components/common/Modal'
import { FieldColumnMapper } from './components/FieldColumnMapper'
import {
  extractEventFields,
  inferJsonType,
  findBestMatchingField,
  getNestedValue,
  validateColumnMappings,
  isTypeCompatible,
  getMappingType,
} from './helpers'
import { TableColumn, TableSchema, DatabaseAccessTestFn, TableAccessTestFn, ConnectionConfig } from './types'
import { DatabaseTableSelectContainer } from './components/DatabaseTableSelectContainer'
import { BatchDelaySelector } from './components/BatchDelaySelector'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { generateApiConfig } from './helpers'
import { useRouter } from 'next/navigation'

export function ClickhouseJoinMapper({
  onNext,
  primaryIndex = 0,
  secondaryIndex = 1,
}: {
  onNext: (step: StepKeys) => void
  primaryIndex: number
  secondaryIndex: number
}) {
  const {
    clickhouseStore,
    topicsStore,
    setApiConfig,
    pipelineId,
    setPipelineId,
    joinStore,
    kafkaStore,
    setOperationsSelected,
  } = useStore()
  const analytics = useJourneyAnalytics()
  const router = useRouter()
  const { clickhouseConnection, clickhouseDestination, setClickhouseDestination, getDatabases } = clickhouseStore

  const { connectionStatus } = clickhouseConnection

  // Get topics data
  const primaryTopic = topicsStore.getTopic(primaryIndex)
  const secondaryTopic = topicsStore.getTopic(secondaryIndex)

  // Add tracking refs to avoid re-renders and prevent infinite loops
  const viewTrackedRef = useRef(false)
  const completionTrackedRef = useRef(false)

  // Store-only state (no local state duplication)
  const selectedDatabase = clickhouseDestination?.database || ''
  const selectedTable = clickhouseDestination?.table || ''
  const tableSchema: TableSchema = {
    columns: clickhouseDestination?.destinationColumns || [],
  }
  const mappedColumns = useMemo(() => clickhouseDestination?.mapping || [], [clickhouseDestination?.mapping])
  const maxBatchSize = clickhouseDestination?.maxBatchSize || 1000
  const maxDelayTime = clickhouseDestination?.maxDelayTime || 1000
  const maxDelayTimeUnit = clickhouseDestination?.maxDelayTimeUnit || 'm'

  // Local state for UI-specific concerns only
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [eventFields, setEventFields] = useState<string[]>([])
  const [primaryEventData, setPrimaryEventData] = useState<any>(primaryTopic?.selectedEvent?.event?.event || null)
  const secondaryEventData = secondaryTopic?.selectedEvent?.event?.event || null

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

  // Use hooks for data fetching
  const { databases, isLoading: databasesLoading, error: databasesError, fetchDatabases } = useClickhouseDatabases()
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

  // Add effect to reset state when connection changes
  useEffect(() => {
    // Create a connection identifier string
    const currentConnectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.port}:${clickhouseConnection.directConnection.username}`

    // If we have a previous connection and it's different, reset state
    if (connectionRef.current && connectionRef.current !== currentConnectionId) {
      // Reset store state
      setClickhouseDestination({
        ...clickhouseDestination,
        database: '',
        table: '',
        mapping: [],
        destinationColumns: [],
      })
    }

    // Update reference with current connection
    connectionRef.current = currentConnectionId
  }, [clickhouseConnection, primaryTopic?.name, secondaryTopic?.name, setClickhouseDestination])

  // Basic page view tracking, only track once on component mount
  useEffect(() => {
    if (!viewTrackedRef.current) {
      analytics.page.joinKey({
        primaryTopicName: primaryTopic?.name,
        secondaryTopicName: secondaryTopic?.name,
      })
      viewTrackedRef.current = true
    }
  }, [analytics.page, primaryTopic?.name, secondaryTopic?.name])

  // Get connection config
  const getConnectionConfig = () => ({
    ...clickhouseConnection.directConnection,
    connectionType: 'direct' as const,
  })

  const { testDatabaseAccess, testTableAccess } = useClickhouseConnection()

  // Create wrapper functions that match the expected type signatures
  const testDatabaseAccessWrapper = async (connectionConfig: ConnectionConfig) => {
    if (!connectionConfig.database) {
      return { success: false, error: 'No database specified' }
    }
    const result = await testDatabaseAccess({
      host: connectionConfig.host,
      port: connectionConfig.port,
      username: connectionConfig.username,
      password: connectionConfig.password,
      database: connectionConfig.database,
      useSSL: connectionConfig.useSSL,
      connectionType: connectionConfig.connectionType,
    })
    return { success: result.success, error: result.error }
  }

  const testTableAccessWrapper = async (connectionConfig: ConnectionConfig) => {
    // For table access, we need to get the table from the current selection
    if (!connectionConfig.database || !selectedTable) {
      return { success: false, error: 'No database or table specified' }
    }
    const result = await testTableAccess({
      host: connectionConfig.host,
      port: connectionConfig.port,
      username: connectionConfig.username,
      password: connectionConfig.password,
      database: connectionConfig.database,
      table: selectedTable,
      useSSL: connectionConfig.useSSL,
      connectionType: connectionConfig.connectionType,
    })
    return { success: result.success, error: result.error }
  }

  // Sync table schema from store when it's updated
  useEffect(() => {
    if (storeSchema && storeSchema.length > 0) {
      // Only update if we don't already have the same schema
      const currentSchema = clickhouseDestination?.destinationColumns || []
      if (
        currentSchema.length === storeSchema.length &&
        currentSchema.every((col, index) => col.name === storeSchema[index]?.name)
      ) {
        return
      }

      setClickhouseDestination({
        ...clickhouseDestination,
        destinationColumns: storeSchema,
        // Always create default mapping when schema changes, unless we already have a valid mapping
        mapping:
          clickhouseDestination?.mapping?.length > 0 &&
          clickhouseDestination.mapping.length === storeSchema.length &&
          clickhouseDestination.mapping.every((col, index) => col.name === storeSchema[index]?.name)
            ? clickhouseDestination.mapping
            : storeSchema.map((col) => ({
                ...col,
                jsonType: '',
                isNullable: false,
                isKey: false,
                eventField: '',
              })),
      })
    }
  }, [storeSchema, setClickhouseDestination])

  // Load table schema when database and table are selected
  useEffect(() => {
    if (selectedDatabase && selectedTable) {
      // If we already have schema data in the store, use that
      if (
        clickhouseDestination?.destinationColumns?.length > 0 &&
        clickhouseDestination.database === selectedDatabase &&
        clickhouseDestination.table === selectedTable
      ) {
        // Schema is already in destination, no need to fetch
        return
      } else {
        // Now this reference is valid
        fetchTableSchema()
      }
    }
  }, [selectedDatabase, selectedTable, clickhouseDestination, fetchTableSchema])

  // Load databases when component mounts, but only if not already loaded
  useEffect(() => {
    if (databases.length > 0) {
      return
    }

    if (connectionStatus === 'success') {
      fetchDatabases()
    }
  }, [connectionStatus, fetchDatabases, databases.length])

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
    if (primaryTopic?.selectedEvent?.event) {
      setPrimaryEventData(primaryTopic.selectedEvent.event)
    }
  }, [primaryTopic?.selectedEvent?.event])

  // Add this effect hook to fetch tables when database is selected
  useEffect(() => {
    if (!selectedDatabase) {
      return
    }

    fetchTables()
  }, [selectedDatabase, fetchTables])

  // Add column mapping functions - store-only
  const updateColumnMapping = (index: number, field: keyof TableColumn, value: any) => {
    const updatedColumns = [...mappedColumns]
    updatedColumns[index] = {
      ...updatedColumns[index],
      [field]: value,
    }
    setClickhouseDestination({
      ...clickhouseDestination,
      mapping: updatedColumns,
    })
  }

  // Update mapEventFieldToColumn to validate and infer types correctly - store-only
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

    setClickhouseDestination({
      ...clickhouseDestination,
      mapping: updatedColumns,
    })
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
      analytics.key.leftJoinKey({
        primaryTopicName: primaryTopic?.name,
        database: selectedDatabase,
        table: selectedTable,
      })

      analytics.key.rightJoinKey({
        secondaryTopicName: secondaryTopic?.name,
        database: selectedDatabase,
        table: selectedTable,
      })
      completionTrackedRef.current = true
    }

    // Create the updated destination config
    const updatedDestination = {
      database: selectedDatabase,
      table: selectedTable,
      destinationColumns: tableSchema.columns,
      mapping: mappedColumns,
      scheme: '',
      maxBatchSize: maxBatchSize || 1000,
      maxDelayTime: maxDelayTime || 1000,
      maxDelayTimeUnit: maxDelayTimeUnit || 'm',
    }

    // Generate API config with pipeline ID
    const apiConfig = generateApiConfig({
      pipelineId,
      setPipelineId,
      clickhouseConnection,
      clickhouseDestination: updatedDestination,
      selectedTopics: [primaryTopic, secondaryTopic],
      getMappingType,
      joinStore,
      kafkaStore,
    })

    // Update the store with both destination and API config
    setClickhouseDestination(updatedDestination)
    setApiConfig(apiConfig)

    setSuccess('Destination configuration saved successfully!')
    setTimeout(() => setSuccess(null), 3000)

    // Move to next step
    router.push('/pipelines')
  }

  // Combine loading states
  const isLoading = databasesLoading || tablesLoading || schemaLoading

  // Combine error states
  const combinedError = error || databasesError || tablesError || schemaError

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-6">
        <DatabaseTableSelectContainer
          availableDatabases={databases}
          selectedDatabase={selectedDatabase}
          setSelectedDatabase={(database) =>
            setClickhouseDestination({
              ...clickhouseDestination,
              database,
              table: '', // Reset table when database changes
              mapping: [],
              destinationColumns: [],
            })
          }
          testDatabaseAccess={testDatabaseAccessWrapper}
          isLoading={isLoading}
          getConnectionConfig={getConnectionConfig}
          availableTables={availableTables}
          selectedTable={selectedTable}
          setSelectedTable={(table) =>
            setClickhouseDestination({
              ...clickhouseDestination,
              table,
              mapping: [], // Reset mapping when table changes
              destinationColumns: [],
            })
          }
          testTableAccess={testTableAccessWrapper}
        />

        {/* Column Mapping */}
        {selectedTable && (tableSchema.columns.length > 0 || storeSchema?.length > 0) && !schemaLoading && (
          <>
            <div className="transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
              <BatchDelaySelector
                maxBatchSize={maxBatchSize}
                maxDelayTime={maxDelayTime}
                maxDelayTimeUnit={maxDelayTimeUnit}
                onMaxBatchSizeChange={(value) =>
                  setClickhouseDestination({
                    ...clickhouseDestination,
                    maxBatchSize: value,
                  })
                }
                onMaxDelayTimeChange={(value) =>
                  setClickhouseDestination({
                    ...clickhouseDestination,
                    maxDelayTime: value,
                  })
                }
                onMaxDelayTimeUnitChange={(value) =>
                  setClickhouseDestination({
                    ...clickhouseDestination,
                    maxDelayTimeUnit: value,
                  })
                }
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

        {combinedError && (
          <div className="p-3 bg-background-neutral-faded text-red-700 rounded-md flex items-center">
            <XCircleIcon className="h-5 w-5 mr-2" />
            <span>{combinedError}</span>
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
