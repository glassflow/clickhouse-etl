import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/src/components/ui/button'
import { XCircleIcon } from '@heroicons/react/24/outline'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import { FieldColumnMapper } from './components/FieldColumnMapper'
import { DatabaseTableSelectContainer } from './components/DatabaseTableSelectContainer'
import { BatchDelaySelector } from './components/BatchDelaySelector'
import { CacheRefreshButton } from './components/CacheRefreshButton'
import FormActions from '@/src/components/shared/FormActions'
import { createPipeline } from '@/src/api/pipeline'

import { StepKeys, OperationKeys } from '@/src/config/constants'

import { cn } from '@/src/utils/common.client'
import {
  inferJsonType,
  findBestMatchingField,
  getNestedValue,
  validateColumnMappings,
  isTypeCompatible,
  getMappingType,
  generateApiConfig,
} from './utils'
import { extractEventFields } from '@/src/utils/common.client'

import { useStore } from '@/src/store'
import { useClickhouseConnection } from '@/src/hooks/useClickhouseConnection'
import { useClickhouseDatabases } from '@/src/hooks/useClickhouseDatabases'
import { useClickhouseTables } from '@/src/hooks/useClickhouseTables'
import { useClickhouseTableSchema } from '@/src/hooks/useClickhouseTableSchema'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

import { TableColumn, TableSchema, DatabaseAccessTestFn, TableAccessTestFn, ConnectionConfig } from './types'

import { getRuntimeEnv } from '@/src/utils/common.client'

type MappingMode = 'single' | 'join' | 'dedup'

interface ClickhouseMapperProps {
  onCompleteStep: (step: StepKeys) => void
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
}

const runtimeEnv = getRuntimeEnv()
const isPreviewMode = runtimeEnv.NEXT_PUBLIC_PREVIEW_MODE === 'true' || process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true'

export function ClickhouseMapper({
  onCompleteStep,
  standalone,
  readOnly,
  toggleEditMode,
  pipelineActionState,
}: ClickhouseMapperProps) {
  const router = useRouter()
  const {
    clickhouseConnectionStore,
    clickhouseDestinationStore,
    kafkaStore,
    joinStore,
    topicsStore,
    coreStore,
    deduplicationStore,
  } = useStore()
  const analytics = useJourneyAnalytics()
  const { clickhouseConnection, getDatabases, getTables, getTableSchema, updateDatabases, getConnectionId } =
    clickhouseConnectionStore
  const { clickhouseDestination, setClickhouseDestination } = clickhouseDestinationStore

  const { connectionStatus, connectionError, connectionType } = clickhouseConnection
  const { getTopic } = topicsStore
  const {
    setApiConfig,
    setPipelineId,
    setOperationsSelected,
    pipelineId,
    pipelineName,
    setPipelineName,
    operationsSelected,
  } = coreStore

  // Determine operation mode and indices
  const isJoinOperation =
    operationsSelected.operation === OperationKeys.JOINING ||
    operationsSelected.operation === OperationKeys.DEDUPLICATION_JOINING
  const mode: MappingMode = isJoinOperation ? 'join' : 'single'
  const index = 0
  const primaryIndex = 0
  const secondaryIndex = 1

  // Topic data based on mode
  const selectedTopic = mode === 'single' ? getTopic(index) : null
  const primaryTopic = mode !== 'single' ? topicsStore.getTopic(primaryIndex) : null
  const secondaryTopic = mode !== 'single' ? topicsStore.getTopic(secondaryIndex) : null

  const selectedEvent = selectedTopic?.selectedEvent
  const topicEvents = selectedTopic?.events
  const topicName = selectedTopic?.name

  // Analytics tracking states (keep these as local state since they're UI-specific)
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const [hasTrackedDatabaseSelection, setHasTrackedDatabaseSelection] = useState(false)
  const [hasTrackedTableSelection, setHasTrackedTableSelection] = useState(false)
  const [hasTrackedFieldMapping, setHasTrackedFieldMapping] = useState(false)
  const [prevMappedFieldsCount, setPrevMappedFieldsCount] = useState(0)

  // Initialize state from store values
  const [selectedDatabase, setSelectedDatabase] = useState<string>(clickhouseDestination?.database || '')
  const [selectedTable, setSelectedTable] = useState<string>(clickhouseDestination?.table || '')
  const [tableSchema, setTableSchema] = useState<TableSchema>({
    columns: clickhouseDestination?.destinationColumns || [],
  })
  const [mappedColumns, setMappedColumns] = useState<TableColumn[]>(clickhouseDestination?.mapping || [])
  const [maxBatchSize, setMaxBatchSize] = useState(clickhouseDestination?.maxBatchSize || 1000)
  const [maxDelayTime, setMaxDelayTime] = useState(clickhouseDestination?.maxDelayTime || 1)
  const [maxDelayTimeUnit, setMaxDelayTimeUnit] = useState(clickhouseDestination?.maxDelayTimeUnit || 'm')

  // Local state for UI-specific concerns only
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [eventFields, setEventFields] = useState<string[]>([])
  const [eventData, setEventData] = useState<any>(selectedEvent?.event || null)

  // Join/dedup specific state
  const [primaryEventData, setPrimaryEventData] = useState<any>(primaryTopic?.selectedEvent?.event?.event || null)
  const [primaryEventFields, setPrimaryEventFields] = useState<string[]>([])
  const [secondaryEventFields, setSecondaryEventFields] = useState<string[]>([])

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

  // Add these state variables to track what action to take after validation
  const [pendingAction, setPendingAction] = useState<'none' | 'save'>('none')

  const selectedTopics = useMemo(() => {
    if (mode === 'single') {
      return selectedTopic ? [selectedTopic] : []
    } else {
      return [primaryTopic, secondaryTopic].filter(Boolean)
    }
  }, [mode, selectedTopic, primaryTopic, secondaryTopic])

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

  // Add tracking refs to avoid re-renders and prevent infinite loops (for join mode)
  const viewTrackedRef = useRef(false)
  const completionTrackedRef = useRef(false)

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

  // Reset UI state when the connection changes
  useEffect(() => {
    // Create a connection identifier string to detect changes
    const currentConnectionId = `${clickhouseConnection.directConnection.host}:${clickhouseConnection.directConnection.httpPort}:${clickhouseConnection.directConnection.username}`

    // Check if connection has changed since we last loaded data
    if (lastConnectionRef.current && lastConnectionRef.current !== currentConnectionId) {
      // Connection changed, reset local state
      setSelectedDatabase('')
      setSelectedTable('')
      setTableSchema({ columns: [] })
      setMappedColumns([])
    }

    // Update the connection reference
    lastConnectionRef.current = currentConnectionId
  }, [clickhouseConnection, topicName, index, primaryTopic?.name, secondaryTopic?.name])

  // Track initial view based on mode
  useEffect(() => {
    if (!hasTrackedView) {
      if (mode === 'single') {
        analytics.page.selectDestination({
          topicName,
          topicIndex: index,
          isReturningVisit: !!clickhouseDestination?.database,
          existingMappingCount: clickhouseDestination?.mapping?.length || 0,
        })
      } else {
        analytics.page.joinKey({
          primaryTopicName: primaryTopic?.name,
          secondaryTopicName: secondaryTopic?.name,
        })
      }
      setHasTrackedView(true)
    }
  }, [
    hasTrackedView,
    analytics.page,
    topicName,
    index,
    clickhouseDestination,
    mode,
    primaryTopic?.name,
    secondaryTopic?.name,
  ])

  // Get connection config based on connection type
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
      httpPort: connectionConfig.httpPort,
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
      httpPort: connectionConfig.httpPort,
      username: connectionConfig.username,
      password: connectionConfig.password,
      database: connectionConfig.database,
      table: selectedTable,
      useSSL: connectionConfig.useSSL,
      connectionType: connectionConfig.connectionType,
    })
    return { success: result.success, error: result.error }
  }

  // Enhanced database selection handler with tracking
  const handleDatabaseSelection = useCallback(
    (database: string) => {
      setSelectedDatabase(database)
      setSelectedTable('') // Reset table when database changes
      setTableSchema({ columns: [] })
      setMappedColumns([])

      // Track database selection if it's the first time
      if (!hasTrackedDatabaseSelection || clickhouseDestination?.database !== database) {
        analytics.destination.databaseSelected({
          database,
          topicName: mode === 'single' ? topicName : `${primaryTopic?.name} + ${secondaryTopic?.name}`,
          topicIndex: index,
          isChange: !!clickhouseDestination?.database && clickhouseDestination.database !== database,
        })
        setHasTrackedDatabaseSelection(true)
      }
    },
    [
      hasTrackedDatabaseSelection,
      clickhouseDestination,
      analytics.destination,
      topicName,
      index,
      mode,
      primaryTopic?.name,
      secondaryTopic?.name,
    ],
  )

  // Enhanced table selection handler with tracking
  const handleTableSelection = useCallback(
    (table: string) => {
      // Only update if the table actually changed
      if (selectedTable === table) {
        return
      }

      setSelectedTable(table)
      setTableSchema({ columns: [] })
      setMappedColumns([])

      // Track table selection if it's the first time or a change
      if (!hasTrackedTableSelection || clickhouseDestination?.table !== table) {
        analytics.destination.tableSelected({
          database: selectedDatabase,
          table,
          topicName: mode === 'single' ? topicName : `${primaryTopic?.name} + ${secondaryTopic?.name}`,
          topicIndex: index,
          isChange: !!clickhouseDestination?.table && clickhouseDestination.table !== table,
        })
        setHasTrackedTableSelection(true)
      }
    },
    [
      hasTrackedTableSelection,
      clickhouseDestination,
      selectedDatabase,
      analytics.destination,
      topicName,
      index,
      mode,
      primaryTopic?.name,
      secondaryTopic?.name,
    ],
  )

  // Sync table schema from store when it's updated
  useEffect(() => {
    if (storeSchema && storeSchema.length > 0) {
      // Only update if the schema has actually changed
      const schemaChanged =
        tableSchema.columns.length !== storeSchema.length ||
        !tableSchema.columns.every(
          (col, index) =>
            col.name === storeSchema[index]?.name &&
            (col.type === storeSchema[index]?.type || col.type === storeSchema[index]?.column_type) &&
            col.isNullable === storeSchema[index]?.isNullable,
        )

      if (!schemaChanged) {
        return
      }

      // Check if we have existing mappings that can be preserved
      const shouldKeepExistingMapping =
        mappedColumns.length > 0 &&
        mappedColumns.length === storeSchema.length &&
        mappedColumns.every((col, index) => col.name === storeSchema[index]?.name)

      // Create new mapping - preserve existing mappings where possible
      const newMapping = shouldKeepExistingMapping
        ? mappedColumns.map((existingCol, index) => ({
            ...storeSchema[index], // Update with latest schema info
            jsonType: existingCol.jsonType,
            isNullable: existingCol.isNullable,
            isKey: existingCol.isKey,
            eventField: existingCol.eventField,
            ...(existingCol.sourceTopic && { sourceTopic: existingCol.sourceTopic }), // Preserve source topic for join mode
          }))
        : storeSchema.map((col) => ({
            ...col,
            jsonType: '',
            isNullable: false,
            isKey: false,
            eventField: '',
          }))

      setTableSchema({ columns: storeSchema })
      setMappedColumns(newMapping)
    }
  }, [storeSchema, tableSchema.columns, mappedColumns])

  // Load table schema when database and table are selected
  useEffect(() => {
    if (selectedDatabase && selectedTable) {
      // First check if we have schema data in the new store structure
      const schemaFromStore = getTableSchema(selectedDatabase, selectedTable)

      if (schemaFromStore.length > 0) {
        // Schema is already in store, the sync effect above will handle it
        return
      } else if (
        // Fallback to old pattern for backward compatibility
        clickhouseDestination?.destinationColumns?.length > 0 &&
        clickhouseDestination.database === selectedDatabase &&
        clickhouseDestination.table === selectedTable
      ) {
        // Schema is already in destination, no need to fetch
        return
      } else {
        // Fetch schema from API using hook
        fetchTableSchema()
      }
    }
  }, [selectedDatabase, selectedTable, getTableSchema, clickhouseDestination, fetchTableSchema])

  // Load event fields when event data changes (single mode)
  useEffect(() => {
    if (mode !== 'single') return

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
          return
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
            } else {
              console.log(`No match found for column "${col.name}"`)
            }
          })

          setMappedColumns(updatedColumns)
          setClickhouseDestination({
            ...clickhouseDestination,
            mapping: updatedColumns,
          })

          // Track auto-mapping success (only track once when it happens)
          const autoMappedCount = updatedColumns.filter((col) => col.eventField).length
        }
      } else {
        console.log('No event data found')
      }
    }
  }, [selectedEvent, topicEvents, clickhouseDestination, mappedColumns, setClickhouseDestination, mode])

  // Load event fields for join/dedup mode
  useEffect(() => {
    if (mode === 'single') return

    // Extract fields from primary event
    if (primaryEventData) {
      const fields = extractEventFields(primaryEventData)
      setPrimaryEventFields(fields)
      setEventFields([...fields]) // Initialize with primary fields
    }
  }, [primaryEventData, mode])

  useEffect(() => {
    if (mode === 'single') return

    // Extract fields from secondary event
    if (secondaryTopic?.selectedEvent?.event) {
      const fields = extractEventFields(secondaryTopic.selectedEvent.event)
      setSecondaryEventFields(fields)
      setEventFields((prev) => [...prev, ...fields]) // Add secondary fields
    }
  }, [secondaryTopic?.selectedEvent?.event?.event, mode])

  // Update effect for handling event data changes to handle nested structure (join/dedup mode)
  useEffect(() => {
    if (mode === 'single') return

    if (primaryTopic?.selectedEvent?.event) {
      setPrimaryEventData(primaryTopic.selectedEvent.event)
    }
  }, [primaryTopic?.selectedEvent?.event, mode])

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
    if (databases.length > 0) {
      return
    }

    if (connectionStatus === 'success') {
      fetchDatabases()
    }
  }, [connectionStatus, fetchDatabases, databases.length])

  // Load tables when database is selected
  useEffect(() => {
    if (!selectedDatabase) {
      return
    }

    fetchTables()
  }, [selectedDatabase, fetchTables])

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
  const mapEventFieldToColumn = (index: number, eventField: string, source?: 'primary' | 'secondary') => {
    const updatedColumns = [...mappedColumns]

    // Get the appropriate event data based on mode and source
    let fieldValue: any
    if (mode === 'single') {
      fieldValue = eventField ? getNestedValue(eventData, eventField) : undefined
    } else {
      const eventData =
        source === 'secondary' ? secondaryTopic?.selectedEvent?.event?.event : primaryTopic?.selectedEvent?.event?.event
      fieldValue = eventData ? getNestedValue(eventData, eventField) : undefined
    }

    let inferredType = eventField ? inferJsonType(fieldValue) : updatedColumns[index].jsonType

    // Ensure we have a type - default to string if we couldn't infer a type from the data
    if (!inferredType && eventField) {
      inferredType = 'string'
    }

    // Determine which topic this field belongs to (for join/dedup mode)
    const topicName =
      mode !== 'single' && source ? (source === 'secondary' ? secondaryTopic?.name : primaryTopic?.name) : undefined

    updatedColumns[index] = {
      ...updatedColumns[index],
      eventField: eventField,
      jsonType: inferredType,
      ...(topicName && { sourceTopic: topicName }), // Only add sourceTopic for join/dedup mode
    }

    // Check compatibility immediately for better user feedback
    const isCompatible = isTypeCompatible(inferredType, updatedColumns[index].type || 'string')

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
        const isActuallyNullable = column?.type?.includes('Nullable') || column.isNullable === true

        if (isActuallyNullable) {
          issues.unmappedNullableColumns.push(column.name)
        } else {
          issues.unmappedNonNullableColumns.push(column.name)
        }
      }
    })

    // Find extra event fields
    const allEventFields = mode === 'single' ? eventFields : [...primaryEventFields, ...secondaryEventFields]
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
  }, [
    mappedColumns,
    tableSchema.columns,
    eventFields,
    primaryEventFields,
    secondaryEventFields,
    mode,
    analytics.destination,
    topicName,
    index,
  ])

  // Add save configuration logic
  const saveDestinationConfig = useCallback(() => {
    console.log('saveDestinationConfig: called')
    console.log('saveDestinationConfig: mappedColumns =', mappedColumns)
    console.log('saveDestinationConfig: selectedDatabase =', selectedDatabase)
    console.log('saveDestinationConfig: selectedTable =', selectedTable)

    // Set the pending action to 'save' so we know what to do after validation
    setPendingAction('save')

    analytics.destination.columnsSelected({
      count: mappedColumns.length,
    })

    // Run validation
    console.log('saveDestinationConfig: running validation...')
    const validationResult = validateMapping()
    console.log('saveDestinationConfig: validationResult =', validationResult)

    if (validationResult) {
      console.log('saveDestinationConfig: showing validation modal')
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
      console.log('saveDestinationConfig: no validation issues, proceeding to completeConfigSave')
      // No validation issues, proceed directly
      completeConfigSave()
    }
  }, [validateMapping])

  // Handle discard changes for clickhouse destination configuration
  const handleDiscardChanges = useCallback(() => {
    console.log('Discarding changes for clickhouse destination section', {
      lastSavedConfig: coreStore.getLastSavedConfig(),
      mode: coreStore.mode,
    })

    // Discard clickhouse destination section
    coreStore.discardSection('clickhouse-destination')
  }, [coreStore])

  // Complete the save after modal confirmation
  const completeConfigSave = useCallback(() => {
    console.log('completeConfigSave: called')
    console.log('completeConfigSave: isPreviewMode =', isPreviewMode)

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

    // Track completion for join mode
    if (mode !== 'single' && !completionTrackedRef.current) {
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
    console.log('completeConfigSave: generating API config...')
    const apiConfig = generateApiConfig({
      pipelineId,
      pipelineName,
      setPipelineId,
      clickhouseConnection,
      clickhouseDestination: updatedDestination,
      selectedTopics,
      getMappingType,
      joinStore,
      kafkaStore,
      deduplicationStore,
    })

    // Update the store with the new destination config
    setClickhouseDestination(updatedDestination)
    setApiConfig(apiConfig)

    setSuccess('Destination configuration saved successfully!')
    setTimeout(() => setSuccess(null), 3000)

    if (isPreviewMode) {
      console.log('completeConfigSave: navigating to review mode')
      // Navigate to the review configuration step for preview
      onCompleteStep(StepKeys.CLICKHOUSE_MAPPER)
    } else {
      console.log('completeConfigSave: deploying pipeline in direct mode')
      // Direct mode: Deploy pipeline immediately and then navigate to pipelines page
      deployPipelineAndNavigate(apiConfig)
    }
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
    mode,
    primaryTopic?.name,
    secondaryTopic?.name,
  ])

  // Add function to deploy pipeline and navigate
  const deployPipelineAndNavigate = useCallback(
    async (apiConfig: any) => {
      console.log('deployPipelineAndNavigate: called with apiConfig =', apiConfig)
      try {
        // Deploy the pipeline
        console.log('deployPipelineAndNavigate: calling createPipeline...')
        const response = await createPipeline(apiConfig)
        console.log('deployPipelineAndNavigate: createPipeline response =', response)

        // Set the pipeline ID from the response
        const newPipelineId = response.pipeline_id || apiConfig.pipeline_id
        console.log('deployPipelineAndNavigate: setting pipeline ID =', newPipelineId)
        setPipelineId(newPipelineId)

        // Navigate to pipelines page to show deployment status
        console.log('deployPipelineAndNavigate: navigating to /pipelines')
        router.push('/pipelines')
      } catch (error: any) {
        console.error('deployPipelineAndNavigate: Failed to deploy pipeline:', error)
        setError(`Failed to deploy pipeline: ${error.message}`)
      }
    },
    [setPipelineId, router],
  )

  // Add this useEffect to clean up modal state
  useEffect(() => {
    return () => {
      // Clean up modal state when component unmounts
      setModalProps((prev) => ({ ...prev, visible: false }))
    }
  }, [])

  // Combine loading states
  const isLoading = databasesLoading || tablesLoading || schemaLoading

  // Combine error states
  const combinedError = error || databasesError || tablesError || schemaError

  const handleRefreshDatabases = async () => {
    await fetchDatabases()

    // Clear dependent state when databases are refreshed
    if (selectedDatabase && !databases.includes(selectedDatabase)) {
      setSelectedDatabase('')
      setSelectedTable('')
      setTableSchema({ columns: [] })
      setMappedColumns([])
    }
  }

  const handleRefreshTables = async () => {
    await fetchTables()
    // Clear dependent state when tables are refreshed
    if (selectedTable && !availableTables.includes(selectedTable)) {
      setSelectedTable('')
      setTableSchema({ columns: [] })
      setMappedColumns([])
    }
  }

  const handleRefreshTableSchema = async () => {
    await fetchTableSchema()
    // Don't clear mapping - let the sync effect handle updating the schema
    // while preserving existing mappings where possible
  }

  return (
    <div className="flex flex-col gap-8 mb-4">
      <div className="space-y-6">
        <DatabaseTableSelectContainer
          availableDatabases={databases}
          selectedDatabase={selectedDatabase}
          setSelectedDatabase={handleDatabaseSelection}
          testDatabaseAccess={testDatabaseAccessWrapper}
          isLoading={isLoading}
          getConnectionConfig={getConnectionConfig}
          availableTables={availableTables}
          selectedTable={selectedTable}
          setSelectedTable={handleTableSelection}
          testTableAccess={testTableAccessWrapper}
          onRefreshDatabases={handleRefreshDatabases}
          onRefreshTables={handleRefreshTables}
          readOnly={readOnly}
        />

        {/* Batch Size / Delay Time / Column Mapping */}
        {selectedTable && (tableSchema.columns.length > 0 || storeSchema?.length > 0) && !schemaLoading && (
          <div className="transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
            {/* Table Schema Refresh Button */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-content">Table Schema & Mapping</h3>
              <CacheRefreshButton
                type="tableSchema"
                database={selectedDatabase}
                table={selectedTable}
                onRefresh={handleRefreshTableSchema}
                size="sm"
                variant="outline"
                disabled={readOnly}
              />
            </div>
            <BatchDelaySelector
              maxBatchSize={maxBatchSize}
              maxDelayTime={maxDelayTime}
              maxDelayTimeUnit={maxDelayTimeUnit}
              onMaxBatchSizeChange={setMaxBatchSize}
              onMaxDelayTimeChange={setMaxDelayTime}
              onMaxDelayTimeUnitChange={setMaxDelayTimeUnit}
              readOnly={readOnly}
            />
            <FieldColumnMapper
              eventFields={mode === 'single' ? eventFields : [...primaryEventFields, ...secondaryEventFields]}
              // @ts-expect-error - mappedColumns is not typed correctly
              mappedColumns={mappedColumns}
              updateColumnMapping={updateColumnMapping}
              mapEventFieldToColumn={mapEventFieldToColumn}
              primaryEventFields={mode !== 'single' ? primaryEventFields : undefined}
              secondaryEventFields={mode !== 'single' ? secondaryEventFields : undefined}
              primaryTopicName={mode !== 'single' ? primaryTopic?.name : undefined}
              secondaryTopicName={mode !== 'single' ? secondaryTopic?.name : undefined}
              isJoinMapping={mode !== 'single'}
              readOnly={readOnly}
            />
            {/* TypeCompatibilityInfo is temporarily hidden */}
            {/* <TypeCompatibilityInfo /> */}
            <div className="flex gap-2 mt-4">
              <FormActions
                standalone={standalone}
                onSubmit={saveDestinationConfig}
                onDiscard={handleDiscardChanges}
                isLoading={isLoading}
                isSuccess={!!success}
                disabled={isLoading}
                successText="Continue"
                actionType="primary"
                showLoadingIcon={false}
                regularText="Continue"
                loadingText="Saving..."
                readOnly={readOnly}
                toggleEditMode={toggleEditMode}
                pipelineActionState={pipelineActionState}
              />
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

        {combinedError && (
          <div className="p-3 bg-background-neutral-faded text-red-700 rounded-md flex items-center border border-[var(--color-border-neutral)]">
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
    </div>
  )
}
