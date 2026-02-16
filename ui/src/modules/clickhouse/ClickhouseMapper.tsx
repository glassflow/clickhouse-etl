import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/src/components/ui/button'
import { XCircleIcon } from '@heroicons/react/24/outline'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import { FieldColumnMapper } from './components/FieldColumnMapper'
import { DatabaseTableSelectContainer } from './components/DatabaseTableSelectContainer'
import { BatchDelaySelector } from './components/BatchDelaySelector'
import FormActions from '@/src/components/shared/FormActions'
import { createPipeline } from '@/src/api/pipeline-api'
import { Pipeline } from '@/src/types/pipeline'
import DownloadIconWhite from '@/src/images/download-white.svg'
import Image from 'next/image'

import { StepKeys } from '@/src/config/constants'
import { LATEST_PIPELINE_VERSION } from '@/src/config/pipeline-versions'

import { cn } from '@/src/utils/common.client'
import {
  inferJsonType,
  findBestMatchingField,
  getNestedValue,
  validateColumnMappings,
  isTypeCompatible,
  getMappingType,
  generateApiConfig,
  filterUserMappableColumns,
  hasDefaultExpression,
} from './utils'
import { extractEventFields } from '@/src/utils/common.client'

import { useStore } from '@/src/store'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
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
  onCompleteStandaloneEditing?: () => void
}

const runtimeEnv = getRuntimeEnv()
const isPreviewMode = runtimeEnv.NEXT_PUBLIC_PREVIEW_MODE === 'true' || process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true'

/**
 * Gets the verified type for a field from the topic's schema (set during KafkaTypeVerification step).
 * Falls back to undefined if no verified type is available.
 * @param topic - The topic object (from topicsStore)
 * @param fieldName - The field name to look up
 * @returns The verified type string or undefined if not found
 */
const getVerifiedTypeFromTopic = (topic: any, fieldName: string): string | undefined => {
  if (!topic?.schema?.fields || !Array.isArray(topic.schema.fields)) {
    return undefined
  }
  // Filter out removed fields and find the matching field
  const schemaField = topic.schema.fields.find((f: any) => f.name === fieldName && !f.isRemoved)
  // Prefer userType (explicitly set by user) over type
  return schemaField?.userType || schemaField?.type
}

export function ClickhouseMapper({
  onCompleteStep,
  standalone,
  readOnly,
  toggleEditMode,
  pipelineActionState,
  onCompleteStandaloneEditing,
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
    filterStore,
    transformationStore,
  } = useStore()
  const analytics = useJourneyAnalytics()
  const validationEngine = useValidationEngine()
  const { clickhouseConnection, getDatabases, getTables, getTableSchema, updateDatabases, getConnectionId } =
    clickhouseConnectionStore
  const { clickhouseDestination, setClickhouseDestination, updateClickhouseDestinationDraft } =
    clickhouseDestinationStore

  const { connectionStatus, connectionError, connectionType } = clickhouseConnection
  const { getTopic } = topicsStore
  const { setApiConfig, setPipelineId, pipelineId, pipelineName, pipelineVersion, topicCount } = coreStore

  // Determine operation mode and indices based on topic count
  const isJoinOperation = topicCount === 2
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

  // Add state to track hydration status
  const [isHydrated, setIsHydrated] = useState(false)

  // Add refs to track current values (as a workaround for potential closure issues)
  const maxDelayTimeRef = useRef(maxDelayTime)
  const maxDelayTimeUnitRef = useRef(maxDelayTimeUnit)
  const maxBatchSizeRef = useRef(maxBatchSize)

  // Update refs when state changes
  useEffect(() => {
    maxDelayTimeRef.current = maxDelayTime
  }, [maxDelayTime])

  useEffect(() => {
    maxDelayTimeUnitRef.current = maxDelayTimeUnit
  }, [maxDelayTimeUnit])

  useEffect(() => {
    maxBatchSizeRef.current = maxBatchSize
  }, [maxBatchSize])

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
    unmappedDefaultColumns: string[] // NEW: columns with DEFAULT that are unmapped (warning only)
    extraEventFields: string[]
    incompatibleTypeMappings: any[]
    missingTypeMappings: any[]
  }>({
    unmappedNullableColumns: [],
    unmappedNonNullableColumns: [],
    unmappedDefaultColumns: [], // NEW
    extraEventFields: [],
    incompatibleTypeMappings: [],
    missingTypeMappings: [],
  })

  // Add these state variables to track what action to take after validation
  const [pendingAction, setPendingAction] = useState<'none' | 'save'>('none')

  // State to store config when deployment fails (for download)
  const [failedDeploymentConfig, setFailedDeploymentConfig] = useState<any>(null)

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

  // Add tracking refs to avoid re-renders and prevent infinite loops
  const viewTrackedRef = useRef(false)

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
  }, [clickhouseConnection])
  // NOTE: Removed topicName, index, primaryTopic?.name, secondaryTopic?.name from dependencies
  // When topics change, we want to preserve database/table/schema selections for better UX
  // The mapping invalidation is handled separately by the topic selector which clears mappings in the store

  // Track initial view based on mode
  useEffect(() => {
    if (!hasTrackedView) {
      analytics.page.selectDestination({})
      setHasTrackedView(true)
    }
  }, [hasTrackedView, analytics.page])

  // SAFETY NET: Check for missing event data when component mounts or enters edit mode
  // This ensures ClickHouse mapping has the necessary event data to display fields
  useEffect(() => {
    const checkAndRefreshEventData = async () => {
      // Only check when not in read-only mode (i.e., in edit mode or creation mode)
      if (readOnly) return

      let needsRefresh = false
      const topicsToRefresh: number[] = []

      if (mode === 'single') {
        // Single topic mode: check if the selected topic has event data
        if (selectedTopic && !selectedEvent?.event) {
          needsRefresh = true
          topicsToRefresh.push(index)
        }
      } else {
        // Join/dedup mode: check both primary and secondary topics
        if (primaryTopic && !primaryTopic.selectedEvent?.event) {
          needsRefresh = true
          topicsToRefresh.push(primaryIndex)
        }
        if (secondaryTopic && !secondaryTopic.selectedEvent?.event) {
          needsRefresh = true
          topicsToRefresh.push(secondaryIndex)
        }
      }

      // If event data is missing, trigger section hydration
      if (needsRefresh) {
        try {
          const { coreStore } = useStore.getState()
          const baseConfig = coreStore.baseConfig

          if (baseConfig) {
            await coreStore.hydrateSection('topics', baseConfig)
          } else {
            console.warn('[ClickhouseMapper] No base config available for re-hydration')
          }
        } catch (error) {
          console.error('[ClickhouseMapper] Failed to re-hydrate topics:', error)
        }
      }
    }

    checkAndRefreshEventData()
  }, [readOnly, mode, selectedTopic, selectedEvent, primaryTopic, secondaryTopic, index, primaryIndex, secondaryIndex])

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

      // Persist draft to store for restoration when navigating back to this step
      // Note: This does NOT mark the step as valid - only "Continue" does that
      updateClickhouseDestinationDraft({
        database,
        table: '',
        destinationColumns: [],
        mapping: [],
      })

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
      updateClickhouseDestinationDraft,
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

      // Persist draft to store for restoration when navigating back to this step
      // Note: This does NOT mark the step as valid - only "Continue" does that
      updateClickhouseDestinationDraft({
        table,
        destinationColumns: [],
        mapping: [],
      })

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
      updateClickhouseDestinationDraft,
    ],
  )

  // Sync table schema from store when it's updated
  useEffect(() => {
    if (storeSchema && storeSchema.length > 0) {
      // Filter out ALIAS and MATERIALIZED columns
      const filteredSchema = filterUserMappableColumns(storeSchema)

      // Only update if the schema has actually changed
      const schemaChanged =
        tableSchema.columns.length !== filteredSchema.length ||
        !tableSchema.columns.every(
          (col, index) =>
            col.name === filteredSchema[index]?.name &&
            (col.type === filteredSchema[index]?.type || col.type === filteredSchema[index]?.column_type) &&
            col.isNullable === filteredSchema[index]?.isNullable,
        )

      if (!schemaChanged) {
        return
      }

      // Check if we have existing mappings that can be preserved
      // For editing existing pipelines, we want to preserve mappings even if the schema changes
      const hasExistingMappings = mappedColumns.some((col) => col.eventField)
      const shouldKeepExistingMapping = hasExistingMappings && mappedColumns.length > 0

      // Create new mapping - preserve existing mappings where possible
      const newMapping = shouldKeepExistingMapping
        ? filteredSchema.map((col, index) => {
            // Try to find existing mapping for this column
            const existingCol = mappedColumns.find((mc) => mc.name === col.name)

            if (existingCol) {
              // Preserve existing mapping data
              return {
                ...col,
                jsonType: existingCol.jsonType || '',
                isNullable: existingCol.isNullable || false,
                isKey: existingCol.isKey || false,
                eventField: existingCol.eventField || '',
                ...(existingCol.sourceTopic && { sourceTopic: existingCol.sourceTopic }),
              }
            } else {
              // New column, initialize empty
              return {
                ...col,
                jsonType: '',
                isNullable: false,
                isKey: false,
                eventField: '',
              }
            }
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

      // Persist draft to store so the full form can be restored when navigating back
      // Note: This does NOT mark the step as valid - only "Continue" does that
      updateClickhouseDestinationDraft({
        destinationColumns: filteredSchema,
        mapping: newMapping,
      })
    }
  }, [storeSchema, tableSchema.columns, mappedColumns, updateClickhouseDestinationDraft])

  // Sync local state with store when hydration completes (run only once)
  useEffect(() => {
    if (clickhouseDestination && !isHydrated) {
      // Update local state from store
      setSelectedDatabase(clickhouseDestination.database || '')
      setSelectedTable(clickhouseDestination.table || '')
      setTableSchema({ columns: clickhouseDestination.destinationColumns || [] })

      // If mapping is empty but we have destinationColumns, initialize mappedColumns
      // This happens when mapping is invalidated (e.g., topic change) but schema is preserved
      const hasMapping = clickhouseDestination.mapping && clickhouseDestination.mapping.length > 0
      const hasColumns = clickhouseDestination.destinationColumns && clickhouseDestination.destinationColumns.length > 0

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
      // Mark as hydrated
      setIsHydrated(true)
    }
  }, [isHydrated, standalone]) // Removed clickhouseDestination from dependencies to prevent resetting user changes

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
        // Schema is in destination store, use it directly
        return
      } else {
        // Fetch schema from API using hook
        fetchTableSchema()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDatabase,
    selectedTable,
    // NOTE: fetchTableSchema is intentionally excluded to prevent infinite loops
    // getTableSchema and clickhouseDestination are used inside, but adding them causes loops
  ])

  // Load event fields when event data changes (single mode)
  useEffect(() => {
    if (mode !== 'single') return

    // Check if transformations are enabled
    const isTransformationEnabled =
      transformationStore.transformationConfig.enabled && transformationStore.transformationConfig.fields.length > 0

    // If transformations are enabled, use intermediary schema
    if (isTransformationEnabled) {
      const intermediarySchema = transformationStore.getIntermediarySchema()
      if (intermediarySchema.length > 0) {
        // Extract field names from intermediary schema
        const transformedFields = intermediarySchema.map((field) => field.name)
        setEventFields(transformedFields)

        // Create a map of field names to types for quick lookup
        const fieldTypeMap = new Map(intermediarySchema.map((field) => [field.name, field.type]))

        // Try to auto-map fields if we have mapping data (skip only when at least one field is already mapped)
        if (clickhouseDestination?.mapping?.some((m) => m.eventField)) {
          // Mapping already exists, keep it
          return
        } else if (mappedColumns.length > 0 && transformedFields.length > 0) {
          // Try to auto-map based on field names using transformed field names
          const updatedColumns = [...mappedColumns]
          updatedColumns.forEach((col, index) => {
            // Try to find a matching field by name similarity in transformed fields
            const matchingField = findBestMatchingField(col.name, transformedFields)
            if (matchingField) {
              // Use type from intermediary schema instead of inferring from event data
              const fieldType = fieldTypeMap.get(matchingField) || 'string'
              updatedColumns[index] = {
                ...col,
                eventField: matchingField,
                jsonType: fieldType,
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
      }
      return
    }

    // FIX: Check for selectedEvent.event directly, don't require topicEvents array
    // The topicEvents array might be empty during hydration, but selectedEvent.event can still be populated
    if (selectedEvent?.event) {
      const eventData = selectedEvent.event

      if (eventData) {
        setEventData(eventData)

        // Extract fields from event data
        const fields = extractEventFields(eventData)
        setEventFields(fields)

        // Try to auto-map fields if we have mapping data (skip only when at least one field is already mapped)
        if (clickhouseDestination?.mapping?.some((m) => m.eventField)) {
          // Mapping already exists, keep it
          return
        } else if (mappedColumns.length > 0 && fields.length > 0) {
          // Try to auto-map based on field names
          const updatedColumns = [...mappedColumns]
          updatedColumns.forEach((col, index) => {
            // Try to find a matching field by name similarity
            const matchingField = findBestMatchingField(col.name, fields)
            if (matchingField) {
              // Use verified type from topic schema if available, fallback to inference
              const verifiedType = getVerifiedTypeFromTopic(selectedTopic, matchingField)
              updatedColumns[index] = {
                ...col,
                eventField: matchingField,
                jsonType: verifiedType || inferJsonType(getNestedValue(eventData, matchingField)),
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
  }, [selectedEvent?.event, clickhouseDestination, mappedColumns, setClickhouseDestination, mode, transformationStore])

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

  // Auto-map fields for join/dedup mode (similar to single mode logic)
  useEffect(() => {
    if (mode === 'single') return

    // Only proceed if we have both primary and secondary fields, and mapped columns
    if (primaryEventFields.length === 0 || secondaryEventFields.length === 0 || mappedColumns.length === 0) {
      return
    }

    // Skip only when at least one field is already mapped (don't skip freshly initialized empty rows)
    if (clickhouseDestination?.mapping?.some((m) => m.eventField)) {
      return
    }

    // Try to auto-map based on field names with left topic preference
    const updatedColumns = [...mappedColumns]
    let hasChanges = false

    updatedColumns.forEach((col, index) => {
      if (col.eventField) {
        // Column is already mapped, skip
        return
      }

      // First try to find matching field in primary (left) topic
      let matchingField = findBestMatchingField(col.name, primaryEventFields)
      let source: 'primary' | 'secondary' = 'primary'
      let sourceData = primaryEventData

      // If no match in primary, try secondary (right) topic
      if (!matchingField) {
        matchingField = findBestMatchingField(col.name, secondaryEventFields)
        source = 'secondary'
        sourceData = secondaryTopic?.selectedEvent?.event
      }

      if (matchingField && sourceData) {
        const sourceTopic = source === 'primary' ? primaryTopic?.name : secondaryTopic?.name
        const topicForSchema = source === 'primary' ? primaryTopic : secondaryTopic

        // Use verified type from topic schema if available, otherwise infer from event data
        const verifiedType = getVerifiedTypeFromTopic(topicForSchema, matchingField)
        const jsonType = verifiedType || inferJsonType(getNestedValue(sourceData, matchingField)) || 'string'

        updatedColumns[index] = {
          ...col,
          eventField: matchingField,
          jsonType,
          sourceTopic: sourceTopic,
        }
        hasChanges = true
      }
    })

    if (hasChanges) {
      setMappedColumns(updatedColumns)
      setClickhouseDestination({
        ...clickhouseDestination,
        mapping: updatedColumns,
      })
    }
  }, [
    primaryEventFields,
    secondaryEventFields,
    mappedColumns,
    clickhouseDestination,
    primaryEventData,
    secondaryTopic?.selectedEvent?.event,
    primaryTopic,
    secondaryTopic,
    setClickhouseDestination,
    mode,
  ])

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

  // Continuously validate mappings to update validation issues in real-time
  useEffect(() => {
    if (tableSchema.columns.length === 0 || mappedColumns.length === 0) {
      return
    }

    // Reset validation state
    const issues = {
      unmappedNullableColumns: [] as string[],
      unmappedNonNullableColumns: [] as string[],
      unmappedDefaultColumns: [] as string[], // NEW
      extraEventFields: [] as string[],
      incompatibleTypeMappings: [] as any[],
      missingTypeMappings: [] as any[],
    }

    // Find unmapped columns
    tableSchema.columns.forEach((column) => {
      const mappedColumn = mappedColumns.find((mc) => mc.name === column.name)
      if (!mappedColumn || !mappedColumn.eventField) {
        // Check if the column is actually nullable by examining its type
        const isActuallyNullable = column?.type?.includes('Nullable') || column.isNullable === true

        // Check if the column has a DEFAULT expression
        const columnHasDefault = hasDefaultExpression(column)

        if (columnHasDefault) {
          // Column has DEFAULT - this is just a warning, not an error
          issues.unmappedDefaultColumns.push(column.name)
        } else if (isActuallyNullable) {
          // Column is nullable - safe to omit
          issues.unmappedNullableColumns.push(column.name)
        } else {
          // Column is non-nullable and has no default - this is an error
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
  }, [tableSchema.columns, mappedColumns, eventFields, primaryEventFields, secondaryEventFields, mode])

  // Load databases when component mounts, but only if not already loaded
  useEffect(() => {
    if (databases.length > 0) {
      return
    }

    // Fetch databases if connection is successful or if we have connection details but no databases yet
    const hasConnectionDetails =
      clickhouseConnection.directConnection.host && clickhouseConnection.directConnection.httpPort

    if (connectionStatus === 'success' || hasConnectionDetails) {
      fetchDatabases()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connectionStatus,
    // NOTE: fetchDatabases is intentionally excluded to prevent infinite loops
    // The databases.length guard prevents unnecessary fetches
    databases.length,
    clickhouseConnection.directConnection.host,
    clickhouseConnection.directConnection.httpPort,
    // NOTE: databasesLoading is intentionally excluded to prevent infinite loops
    // When fetch fails, databasesLoading changes from true->false, which would re-trigger this effect
    // and cause repeated notifications for broken ClickHouse connections
  ])

  // Load tables when database is selected
  useEffect(() => {
    if (!selectedDatabase) {
      return
    }

    fetchTables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDatabase,
    // NOTE: fetchTables is intentionally excluded to prevent infinite loops
  ])

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

  // Helper function to perform automatic mapping for join mode (can be called manually)
  const performAutoMappingJoinMode = useCallback(() => {
    if (
      mode === 'single' ||
      primaryEventFields.length === 0 ||
      secondaryEventFields.length === 0 ||
      mappedColumns.length === 0
    ) {
      return false
    }

    const updatedColumns = [...mappedColumns]
    let hasChanges = false

    updatedColumns.forEach((col, index) => {
      if (col.eventField) {
        // Column is already mapped, skip
        return
      }

      // First try to find matching field in primary (left) topic
      let matchingField = findBestMatchingField(col.name, primaryEventFields)
      let source: 'primary' | 'secondary' = 'primary'
      let sourceData = primaryEventData

      // If no match in primary, try secondary (right) topic
      if (!matchingField) {
        matchingField = findBestMatchingField(col.name, secondaryEventFields)
        source = 'secondary'
        sourceData = secondaryTopic?.selectedEvent?.event
      }

      if (matchingField && sourceData) {
        const sourceTopic = source === 'primary' ? primaryTopic?.name : secondaryTopic?.name
        const topicForSchema = source === 'primary' ? primaryTopic : secondaryTopic

        // Use verified type from topic schema if available, otherwise infer from event data
        const verifiedType = getVerifiedTypeFromTopic(topicForSchema, matchingField)
        const jsonType = verifiedType || inferJsonType(getNestedValue(sourceData, matchingField)) || 'string'

        updatedColumns[index] = {
          ...col,
          eventField: matchingField,
          jsonType,
          sourceTopic: sourceTopic,
        }
        hasChanges = true
      }
    })

    if (hasChanges) {
      setMappedColumns(updatedColumns)
      setClickhouseDestination({
        ...clickhouseDestination,
        mapping: updatedColumns,
      })
    }

    return hasChanges
  }, [
    mode,
    primaryEventFields,
    secondaryEventFields,
    mappedColumns,
    primaryEventData,
    secondaryTopic?.selectedEvent?.event,
    primaryTopic,
    secondaryTopic,
    clickhouseDestination,
    setClickhouseDestination,
  ])

  // Unified auto-mapping function that works for both single and join modes
  // This can be triggered on demand via the Auto-Map button
  const performAutoMapping = useCallback(() => {
    if (mappedColumns.length === 0) {
      return false
    }

    // Check if transformations are enabled (only for single mode)
    const isTransformationEnabled =
      mode === 'single' &&
      transformationStore.transformationConfig.enabled &&
      transformationStore.transformationConfig.fields.length > 0

    // Clear existing mappings and perform fresh auto-mapping
    const updatedColumns = mappedColumns.map((col) => ({
      ...col,
      eventField: '', // Clear existing mapping
      jsonType: '', // Clear existing type
      sourceTopic: undefined as string | undefined, // Clear source topic for join mode
    }))

    let hasChanges = false

    if (mode === 'single') {
      // Single mode auto-mapping
      if (isTransformationEnabled) {
        // Use intermediary schema for transformed fields
        const intermediarySchema = transformationStore.getIntermediarySchema()
        if (intermediarySchema.length > 0) {
          const transformedFields = intermediarySchema.map((field) => field.name)
          const fieldTypeMap = new Map(intermediarySchema.map((field) => [field.name, field.type]))

          updatedColumns.forEach((col, index) => {
            const matchingField = findBestMatchingField(col.name, transformedFields)
            if (matchingField) {
              const fieldType = fieldTypeMap.get(matchingField) || 'string'
              updatedColumns[index] = {
                ...col,
                eventField: matchingField,
                jsonType: fieldType,
              }
              hasChanges = true
            }
          })
        }
      } else {
        // Use event fields for non-transformed mode
        if (eventFields.length > 0 && eventData) {
          updatedColumns.forEach((col, index) => {
            const matchingField = findBestMatchingField(col.name, eventFields)
            if (matchingField) {
              const verifiedType = getVerifiedTypeFromTopic(selectedTopic, matchingField)
              updatedColumns[index] = {
                ...col,
                eventField: matchingField,
                jsonType: verifiedType || inferJsonType(getNestedValue(eventData, matchingField)),
              }
              hasChanges = true
            }
          })
        }
      }
    } else {
      // Join/dedup mode auto-mapping
      if (primaryEventFields.length === 0 && secondaryEventFields.length === 0) {
        return false
      }

      updatedColumns.forEach((col, index) => {
        // First try to find matching field in primary (left) topic
        let matchingField = findBestMatchingField(col.name, primaryEventFields)
        let source: 'primary' | 'secondary' = 'primary'
        let sourceData = primaryEventData

        // If no match in primary, try secondary (right) topic
        if (!matchingField) {
          matchingField = findBestMatchingField(col.name, secondaryEventFields)
          source = 'secondary'
          sourceData = secondaryTopic?.selectedEvent?.event
        }

        if (matchingField && sourceData) {
          const sourceTopic = source === 'primary' ? primaryTopic?.name : secondaryTopic?.name
          const topicForSchema = source === 'primary' ? primaryTopic : secondaryTopic

          const verifiedType = getVerifiedTypeFromTopic(topicForSchema, matchingField)
          const jsonType = verifiedType || inferJsonType(getNestedValue(sourceData, matchingField)) || 'string'

          updatedColumns[index] = {
            ...col,
            eventField: matchingField,
            jsonType,
            sourceTopic: sourceTopic,
          }
          hasChanges = true
        }
      })
    }

    if (hasChanges) {
      setMappedColumns(updatedColumns)
      setClickhouseDestination({
        ...clickhouseDestination,
        mapping: updatedColumns,
      })
    }

    return hasChanges
  }, [
    mode,
    mappedColumns,
    eventFields,
    eventData,
    selectedTopic,
    primaryEventFields,
    secondaryEventFields,
    primaryEventData,
    primaryTopic,
    secondaryTopic,
    clickhouseDestination,
    setClickhouseDestination,
    transformationStore,
  ])

  // Map event field to column
  const mapEventFieldToColumn = (index: number, eventField: string, source?: 'primary' | 'secondary') => {
    const updatedColumns = [...mappedColumns]

    // Check if transformations are enabled (only for single mode)
    const isTransformationEnabled =
      mode === 'single' &&
      transformationStore.transformationConfig.enabled &&
      transformationStore.transformationConfig.fields.length > 0

    let inferredType: string

    if (isTransformationEnabled && eventField) {
      // For transformed fields, use type from intermediary schema
      const intermediarySchema = transformationStore.getIntermediarySchema()
      const schemaField = intermediarySchema.find((field) => field.name === eventField)
      inferredType = schemaField?.type || 'string'
    } else {
      // For original fields, first check verified type from topic schema, then infer from event data
      if (mode === 'single') {
        // Single mode: use verified type from topic schema if available
        const verifiedType = eventField ? getVerifiedTypeFromTopic(selectedTopic, eventField) : undefined
        if (verifiedType) {
          inferredType = verifiedType
        } else {
          // Fallback to inferring from event data
          const fieldValue = eventField ? getNestedValue(eventData, eventField) : undefined
          inferredType = eventField ? inferJsonType(fieldValue) : (updatedColumns[index].jsonType ?? 'string')
        }
      } else {
        // Multi-topic mode: use verified type from topic schema if available
        const topicForSchema = source === 'secondary' ? secondaryTopic : primaryTopic
        const verifiedType = eventField ? getVerifiedTypeFromTopic(topicForSchema, eventField) : undefined

        if (verifiedType) {
          inferredType = verifiedType
        } else {
          // Fallback to inferring from event data
          const sourceEventData =
            source === 'secondary'
              ? secondaryTopic?.selectedEvent?.event?.event
              : primaryTopic?.selectedEvent?.event?.event
          const fieldValue = sourceEventData ? getNestedValue(sourceEventData, eventField) : undefined
          inferredType = eventField ? inferJsonType(fieldValue) : (updatedColumns[index].jsonType ?? 'string')
        }
      }

      // Ensure we have a type - default to string if we couldn't infer a type from the data
      if (!inferredType && eventField) {
        inferredType = 'string'
      }
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
    // Use the already computed validation issues from the continuous validation useEffect
    const issues = validationIssues

    // Count mapped fields
    const mappedFieldsCount = mappedColumns.filter((col) => col.eventField).length
    const totalColumnsCount = tableSchema.columns.length

    // Check in order of priority:
    // 1. Type compatibility violations (error)
    // 2. Missing type mappings (error)
    // 3. Non-nullable column violations (error)
    // 4. Unmapped DEFAULT columns (warning) - NEW
    // 5. Unmapped nullable columns (warning)
    // 6. Extra event fields (warning)

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
    } else if (issues.unmappedDefaultColumns.length > 0) {
      // NEW: Warning for DEFAULT columns - allow to proceed
      return {
        type: 'warning',
        canProceed: true,
        title: 'Default Values Will Be Used',
        message: `The following columns have DEFAULT expressions and are not mapped. They will be automatically populated by ClickHouse during insert:
        ${issues.unmappedDefaultColumns.join(', ')}

        Do you want to continue?`,
        okButtonText: 'Continue',
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
  }, [validationIssues, mappedColumns, tableSchema.columns])

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

  // Handle discard changes for clickhouse destination configuration
  const handleDiscardChanges = useCallback(() => {
    // Discard clickhouse destination section
    coreStore.discardSection('clickhouse-destination')
  }, [coreStore])

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

    // Join key tracking is handled in JoinConfigurator, not here
    // This component focuses on destination mapping, not join configuration

    // Use ref values as they represent the absolute current state
    const currentMaxDelayTime = maxDelayTimeRef.current
    const currentMaxDelayTimeUnit = maxDelayTimeUnitRef.current
    const currentMaxBatchSize = maxBatchSizeRef.current

    // Create the updated destination config first
    const updatedDestination = {
      ...clickhouseDestination,
      database: selectedDatabase,
      table: selectedTable,
      mapping: mappedColumns,
      destinationColumns: tableSchema.columns,
      maxBatchSize: currentMaxBatchSize,
      maxDelayTime: currentMaxDelayTime,
      maxDelayTimeUnit: currentMaxDelayTimeUnit,
    }

    // Generate config with the updated destination
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
      filterStore,
      transformationStore,
      version: pipelineVersion, // Respect the original pipeline version
    })

    // Update the store with the new destination config
    setClickhouseDestination(updatedDestination)

    // EXPLICITLY mark as valid to ensure validation state is cleared
    // Even though setClickhouseDestination should do this, we do it explicitly
    clickhouseDestinationStore.markAsValid()

    setApiConfig(apiConfig as Partial<Pipeline>)

    setSuccess('Destination configuration saved successfully!')
    setTimeout(() => setSuccess(null), 3000)

    // If in standalone edit mode, just save to store and mark as dirty
    // The actual deployment will happen when user clicks Resume
    if (standalone && toggleEditMode) {
      // Note: setClickhouseDestination (line 1074) already marks validation as valid
      // No need to call validationEngine.markSectionAsValid() again

      // Mark the configuration as modified (dirty)
      coreStore.markAsDirty()

      // Close the edit modal
      if (onCompleteStandaloneEditing) {
        onCompleteStandaloneEditing()
      }
      return
    }

    // For non-standalone mode (regular pipeline creation flow)
    if (isPreviewMode) {
      // Navigate to the review configuration step for preview
      onCompleteStep(StepKeys.CLICKHOUSE_MAPPER)
    } else {
      // Direct mode: Deploy pipeline immediately and then navigate to pipelines page
      deployPipelineAndNavigate(apiConfig)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    standalone,
    toggleEditMode,
    coreStore,
    onCompleteStandaloneEditing,
    deduplicationStore,
    filterStore,
    pipelineName,
    onCompleteStep,
    // deployPipelineAndNavigate is intentionally excluded - it's defined after this callback
  ])

  // Add function to deploy pipeline and navigate
  const deployPipelineAndNavigate = useCallback(
    async (apiConfig: any) => {
      try {
        // Clear any previous failed config
        setFailedDeploymentConfig(null)

        // Deploy the pipeline
        const response = await createPipeline(apiConfig)

        // Set the pipeline ID from the response
        const newPipelineId = apiConfig?.pipeline_id || ''
        setPipelineId(newPipelineId)

        // Navigate to pipeline details page with deployment progress
        router.push(`/pipelines/${newPipelineId}?deployment=progress`)
      } catch (error: any) {
        console.error('deployPipelineAndNavigate: Failed to deploy pipeline:', error)
        setError(`Failed to deploy pipeline: ${error.message}`)
        // Store the failed config so user can download it
        setFailedDeploymentConfig(apiConfig)
      }
    },
    [setPipelineId, router],
  )

  // Download the failed deployment config
  const handleDownloadFailedConfig = useCallback(() => {
    if (!failedDeploymentConfig) return

    try {
      // Create a clean configuration object for download
      const downloadConfig = {
        ...failedDeploymentConfig,
        exported_at: new Date().toISOString(),
        exported_by: 'GlassFlow UI',
        version: LATEST_PIPELINE_VERSION,
        // TODO: Add more information about the failed deployment attempt such as the error message and the stack trace
        // note: 'This configuration was exported after a failed deployment attempt.',
      }

      // Generate filename with timestamp for uniqueness
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
      const configName = failedDeploymentConfig.name || pipelineName || 'pipeline'
      const sanitizedName = configName.replace(/[^a-zA-Z0-9-_]/g, '_')
      const filename = `${sanitizedName}_config_${timestamp}.json`

      // Create and download the file
      const blob = new Blob([JSON.stringify(downloadConfig, null, 2)], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      console.error('Failed to download configuration:', downloadError)
    }
  }, [failedDeploymentConfig, pipelineName])

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

  // Infers and fills missing jsonType for already-mapped event fields after hydration
  useEffect(() => {
    if (mode === 'single') {
      // Check if transformations are enabled
      const isTransformationEnabled =
        transformationStore.transformationConfig.enabled && transformationStore.transformationConfig.fields.length > 0

      if (mappedColumns.length === 0) return

      let changed = false
      const updated = mappedColumns.map((col) => {
        if (col.eventField && (!col.jsonType || col.jsonType === '')) {
          if (isTransformationEnabled) {
            // For transformed fields, use type from intermediary schema
            const intermediarySchema = transformationStore.getIntermediarySchema()
            const schemaField = intermediarySchema.find((field) => field.name === col.eventField)
            if (schemaField?.type) {
              changed = true
              return { ...col, jsonType: schemaField.type }
            }
          } else {
            // For original fields, first check verified type from topic schema, then infer from event data
            const verifiedType = getVerifiedTypeFromTopic(selectedTopic, col.eventField)
            if (verifiedType) {
              changed = true
              return { ...col, jsonType: verifiedType }
            }
            // Fallback to inferring from event data
            if (!eventData) return col
            const value = getNestedValue(eventData, col.eventField)
            const inferred = inferJsonType(value)
            if (inferred) {
              changed = true
              return { ...col, jsonType: inferred }
            }
          }
        }
        return col
      })

      if (changed) {
        setMappedColumns(updated)
        setClickhouseDestination({
          ...clickhouseDestination,
          mapping: updated,
        })
      }
    } else {
      // join / dedup+join mode
      const primaryData = primaryEventData
      const secondaryData = secondaryTopic?.selectedEvent?.event
      if ((!primaryData && !secondaryData) || mappedColumns.length === 0) return

      let changed = false
      const updated = mappedColumns.map((col) => {
        if (col.eventField && (!col.jsonType || col.jsonType === '')) {
          // Determine the source topic for this field
          let topicForSchema: any = null
          let sourceData: any | null = null

          if (col.sourceTopic) {
            if (primaryTopic?.name && col.sourceTopic === primaryTopic.name) {
              topicForSchema = primaryTopic
              sourceData = primaryData
            } else if (secondaryTopic?.name && col.sourceTopic === secondaryTopic.name) {
              topicForSchema = secondaryTopic
              sourceData = secondaryData
            }
          }
          // fallback: try primary then secondary
          if (!topicForSchema) {
            topicForSchema = primaryTopic || secondaryTopic
            sourceData = primaryData || secondaryData
          }

          // First try to get verified type from topic schema
          const verifiedType = getVerifiedTypeFromTopic(topicForSchema, col.eventField)
          if (verifiedType) {
            changed = true
            return { ...col, jsonType: verifiedType }
          }

          // Fallback: infer type from event data
          const value = sourceData ? getNestedValue(sourceData, col.eventField) : undefined
          const inferred = inferJsonType(value)
          if (inferred) {
            changed = true
            return { ...col, jsonType: inferred }
          }
        }
        return col
      })

      if (changed) {
        setMappedColumns(updated)
        setClickhouseDestination({
          ...clickhouseDestination,
          mapping: updated,
        })
      }
    }
  }, [
    mode,
    eventData,
    primaryEventData,
    secondaryTopic?.selectedEvent?.event,
    mappedColumns,
    primaryTopic,
    secondaryTopic,
    transformationStore,
  ])

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
        {(() => {
          // Show the full form when:
          // 1. A table is selected, AND
          // 2. We have columns (from tableSchema or storeSchema), AND
          // 3. Either not loading OR we already have stored columns (to avoid flash when revisiting the step)
          const hasColumns = tableSchema.columns.length > 0 || storeSchema?.length > 0
          const shouldShow = selectedTable && hasColumns && (!schemaLoading || tableSchema.columns.length > 0)
          return shouldShow
        })() && (
          <div className="transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
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
              typesReadOnly={true} // Types are verified in the earlier type verification step
              unmappedNonNullableColumns={validationIssues.unmappedNonNullableColumns}
              unmappedDefaultColumns={validationIssues.unmappedDefaultColumns}
              onRefreshTableSchema={handleRefreshTableSchema}
              onAutoMap={performAutoMapping}
              selectedDatabase={selectedDatabase}
              selectedTable={selectedTable}
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
                onClose={onCompleteStandaloneEditing}
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
          <div className="space-y-3">
            <div className="p-3 bg-background-neutral-faded text-[var(--text-error)] rounded-md flex items-center border border-[var(--color-border-neutral-faded)]">
              <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{combinedError}</span>
            </div>
            {/* Show download button when deployment fails */}
            {failedDeploymentConfig && (
              <div className="flex items-center gap-3 p-3 bg-background-neutral-faded rounded-md border border-[var(--color-border-neutral-faded)] text-content">
                <span className="text-sm text-muted-foreground">
                  You can download the configuration to save your work and try again later.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadFailedConfig}
                  className="group flex items-center gap-2 whitespace-nowrap btn-action !px-3 !py-2 text-sm h-auto"
                >
                  <Image
                    src={DownloadIconWhite}
                    alt="Download"
                    width={16}
                    height={16}
                    className="filter brightness-100 group-hover:brightness-0 flex-shrink-0"
                  />
                  Download config
                </Button>
              </div>
            )}
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
