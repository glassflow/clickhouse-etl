import { useState, useEffect, useCallback, useMemo } from 'react'

import { InfoModal } from '@/src/components/common/InfoModal'
import { DatabaseTableSelectContainer } from './components/DatabaseTableSelectContainer'
import { MappingFormSection } from './components/MappingFormSection'
import { DestinationErrorBlock } from './components/DestinationErrorBlock'
import { StepKeys } from '@/src/config/constants'

import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

import { MappingMode } from './types'

import {
  useMappingValidation,
  useClickhouseMapperState,
  useClickhouseMapperEventFields,
  useDestinationSave,
} from './hooks'

interface ClickhouseMapperProps {
  onCompleteStep: (step: StepKeys) => void
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}

/**
 * ClickHouse destination mapper: thin orchestrator that composes four hooks
 * (state, event fields, validation, save/deploy) and two subcomponents
 * (MappingFormSection, DestinationErrorBlock).
 */
export function ClickhouseMapper({
  onCompleteStep,
  standalone,
  readOnly,
  toggleEditMode,
  pipelineActionState,
  onCompleteStandaloneEditing,
}: ClickhouseMapperProps) {
  const {
    clickhouseDestinationStore,
    topicsStore,
    coreStore,
    transformationStore,
  } = useStore()
  const analytics = useJourneyAnalytics()
  const { clickhouseDestination, setClickhouseDestination } = clickhouseDestinationStore
  const { getTopic } = topicsStore
  const { topicCount } = coreStore

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
  const topicName = selectedTopic?.name

  // State and data loading from dedicated hook
  const mapperState = useClickhouseMapperState()
  const {
    selectedDatabase,
    selectedTable,
    tableSchema,
    mappedColumns,
    setMappedColumns,
    maxBatchSize,
    setMaxBatchSize,
    maxDelayTime,
    setMaxDelayTime,
    maxDelayTimeUnit,
    setMaxDelayTimeUnit,
    storeSchema,
    isLoading,
    schemaLoading,
    dataError,
    getConnectionConfig,
    handleDatabaseSelection: handleDatabaseSelectionBase,
    handleTableSelection: handleTableSelectionBase,
    updateColumnMapping,
    handleRefreshDatabases,
    handleRefreshTables,
    handleRefreshTableSchema,
    testDatabaseAccessWrapper,
    testTableAccessWrapper,
    maxDelayTimeRef,
    maxDelayTimeUnitRef,
    maxBatchSizeRef,
  } = mapperState
  const { databases, availableTables } = mapperState

  // Event fields and auto-mapping from dedicated hook
  const {
    eventFields,
    primaryEventFields,
    secondaryEventFields,
    performAutoMapping,
    mapEventFieldToColumn,
  } = useClickhouseMapperEventFields({
    mode,
    selectedTopic,
    primaryTopic,
    secondaryTopic,
    transformationStore,
    mappedColumns,
    setMappedColumns,
    clickhouseDestination,
    setClickhouseDestination,
  })

  // Analytics tracking states (keep these as local state since they're UI-specific)
  const [hasTrackedView, setHasTrackedView] = useState(false)
  const [hasTrackedDatabaseSelection, setHasTrackedDatabaseSelection] = useState(false)
  const [hasTrackedTableSelection, setHasTrackedTableSelection] = useState(false)
  const [hasTrackedFieldMapping, setHasTrackedFieldMapping] = useState(false)
  const [prevMappedFieldsCount, setPrevMappedFieldsCount] = useState(0)

  // Wrap state hook handlers with analytics
  const handleDatabaseSelection = useCallback(
    (database: string) => {
      handleDatabaseSelectionBase(database)
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
      handleDatabaseSelectionBase,
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
  const handleTableSelection = useCallback(
    (table: string) => {
      handleTableSelectionBase(table)
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
      handleTableSelectionBase,
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

  // Mapping validation hook - computes validation issues in real-time
  const { validationIssues, validateMapping } = useMappingValidation({
    tableSchema,
    mappedColumns,
    eventFields,
    primaryEventFields,
    secondaryEventFields,
    mode,
  })

  const selectedTopics = useMemo(() => {
    if (mode === 'single') {
      return selectedTopic ? [selectedTopic] : []
    }
    return [primaryTopic, secondaryTopic].filter(Boolean)
  }, [mode, selectedTopic, primaryTopic, secondaryTopic])

  // Save, deploy, discard, download failed config, and modal from dedicated hook
  const {
    saveDestinationConfig,
    handleDiscardChanges,
    handleDownloadFailedConfig,
    onModalComplete,
    pendingAction,
    failedDeploymentConfig,
    modalProps,
    error,
    success,
  } = useDestinationSave({
    validateMapping,
    selectedDatabase,
    selectedTable,
    mappedColumns,
    tableSchema,
    maxDelayTimeRef,
    maxDelayTimeUnitRef,
    maxBatchSizeRef,
    selectedTopics,
    standalone,
    toggleEditMode,
    onCompleteStandaloneEditing,
    onCompleteStep,
  })

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

  const combinedError = error || dataError
  const hasColumns = tableSchema.columns.length > 0 || storeSchema?.length > 0
  const shouldShowMappingForm =
    selectedTable && hasColumns && (!schemaLoading || tableSchema.columns.length > 0)

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

        {shouldShowMappingForm && (
          <MappingFormSection
            maxBatchSize={maxBatchSize}
            maxDelayTime={maxDelayTime}
            maxDelayTimeUnit={maxDelayTimeUnit}
            onMaxBatchSizeChange={setMaxBatchSize}
            onMaxDelayTimeChange={setMaxDelayTime}
            onMaxDelayTimeUnitChange={setMaxDelayTimeUnit}
            eventFields={mode === 'single' ? eventFields : [...primaryEventFields, ...secondaryEventFields]}
            mappedColumns={mappedColumns}
            updateColumnMapping={updateColumnMapping}
            mapEventFieldToColumn={mapEventFieldToColumn}
            primaryEventFields={mode !== 'single' ? primaryEventFields : undefined}
            secondaryEventFields={mode !== 'single' ? secondaryEventFields : undefined}
            primaryTopicName={mode !== 'single' ? primaryTopic?.name : undefined}
            secondaryTopicName={mode !== 'single' ? secondaryTopic?.name : undefined}
            isJoinMapping={mode !== 'single'}
            unmappedNonNullableColumns={validationIssues.unmappedNonNullableColumns}
            unmappedDefaultColumns={validationIssues.unmappedDefaultColumns}
            onRefreshTableSchema={handleRefreshTableSchema}
            onAutoMap={performAutoMapping}
            onSubmit={saveDestinationConfig}
            onDiscard={handleDiscardChanges}
            selectedDatabase={selectedDatabase}
            selectedTable={selectedTable}
            readOnly={readOnly}
            isLoading={isLoading}
            isSuccess={!!success}
            standalone={standalone}
            toggleEditMode={toggleEditMode}
            pipelineActionState={pipelineActionState}
            onClose={onCompleteStandaloneEditing}
          />
        )}

        <DestinationErrorBlock
          error={combinedError}
          failedDeploymentConfig={failedDeploymentConfig}
          onDownloadConfig={handleDownloadFailedConfig}
        />
      </div>

      <InfoModal
        visible={modalProps.visible}
        title={modalProps.title}
        description={modalProps.message}
        okButtonText={modalProps.okButtonText}
        cancelButtonText={modalProps.cancelButtonText}
        onComplete={onModalComplete}
        pendingOperation={pendingAction}
      />
    </div>
  )
}
