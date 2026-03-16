import { useState, useEffect, useCallback, useMemo } from 'react'
import { structuredLogger } from '@/src/observability'
import { InfoModal } from '@/src/components/common/InfoModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { DatabaseTableSelectContainer } from './components/DatabaseTableSelectContainer'
import { NewTableSettings } from './components/NewTableSettings'
import { MappingFormSection } from './components/MappingFormSection'
import { BatchDelaySelector } from './components/BatchDelaySelector'
import FormActions from '@/src/components/shared/FormActions'
import { DestinationErrorBlock } from './components/DestinationErrorBlock'
import { StepKeys } from '@/src/config/constants'

import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

import { MappingMode, TableColumn } from './types'
import { buildInitialMappingFromEventFields, getVerifiedTypeFromTopic } from './utils'

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
  /** When false, only "Use Existing Table" is shown (e.g. when editing a deployed pipeline). Default true. */
  allowCreateNewTable?: boolean
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
  allowCreateNewTable = true,
}: ClickhouseMapperProps) {
  const {
    clickhouseDestinationStore,
    topicsStore,
    coreStore,
    transformationStore,
  } = useStore()
  const analytics = useJourneyAnalytics()
  const { clickhouseDestination, setClickhouseDestination, updateClickhouseDestinationDraft } =
    clickhouseDestinationStore
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
    destinationPath,
    setDestinationPath,
    tableName,
    setTableName,
    engine,
    setEngine,
    orderBy,
    setOrderBy,
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

  const orderByOptions = useMemo(
    () => (mode === 'single' ? eventFields : [...(primaryEventFields ?? []), ...(secondaryEventFields ?? [])]),
    [mode, eventFields, primaryEventFields, secondaryEventFields],
  )

  // Auto-generate mapping for create path when table name + database are set
  useEffect(() => {
    if (
      destinationPath !== 'create' ||
      !tableName?.trim() ||
      !selectedDatabase ||
      orderByOptions.length === 0 ||
      mappedColumns.length > 0
    ) {
      return
    }
    const getJsonType = (field: string) => {
      if (mode === 'single') return getVerifiedTypeFromTopic(selectedTopic, field)
      const primary = primaryTopic ? getVerifiedTypeFromTopic(primaryTopic, field) : undefined
      if (primary) return primary
      return secondaryTopic ? getVerifiedTypeFromTopic(secondaryTopic, field) : undefined
    }
    const initial = buildInitialMappingFromEventFields(orderByOptions, getJsonType)
    setMappedColumns(initial)
    updateClickhouseDestinationDraft({ mapping: initial, destinationColumns: initial })
  }, [
    destinationPath,
    tableName,
    selectedDatabase,
    orderByOptions,
    mode,
    selectedTopic,
    primaryTopic,
    secondaryTopic,
    mappedColumns.length,
    setMappedColumns,
    updateClickhouseDestinationDraft,
  ])

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
    destinationPath,
    orderBy,
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
    destinationPath,
    selectedDatabase,
    selectedTable,
    tableName,
    engine,
    orderBy,
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
            structuredLogger.warn('ClickhouseMapper no base config available for re-hydration')
          }
        } catch (error) {
          structuredLogger.error('ClickhouseMapper failed to re-hydrate topics', { error: error instanceof Error ? error.message : String(error) })
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
  // When editing a deployed pipeline, only "existing" path is allowed.
  const effectiveDestinationPath = allowCreateNewTable ? destinationPath : 'existing'
  const shouldShowMappingFormExisting =
    effectiveDestinationPath === 'existing' &&
    selectedTable &&
    hasColumns &&
    (!schemaLoading || tableSchema.columns.length > 0)
  const shouldShowMappingFormCreate =
    effectiveDestinationPath === 'create' && !!tableName?.trim() && !!selectedDatabase && mappedColumns.length > 0

  // Keep store in sync: for deployed pipelines we must not persist "create" path.
  useEffect(() => {
    if (!allowCreateNewTable && destinationPath === 'create') {
      setDestinationPath('existing')
    }
  }, [allowCreateNewTable, destinationPath, setDestinationPath])

  const handlePathChange = useCallback(
    (value: string) => {
      if (!allowCreateNewTable) return
      setDestinationPath(value === 'existing' ? 'existing' : 'create')
    },
    [allowCreateNewTable, setDestinationPath],
  )

  const handleAddMapping = useCallback(() => {
    const emptyRow: TableColumn = {
      name: '',
      type: 'String',
      jsonType: 'string',
      isNullable: true,
      eventField: '',
    }
    const next = [...mappedColumns, emptyRow]
    setMappedColumns(next)
    updateClickhouseDestinationDraft({ mapping: next })
  }, [mappedColumns, setMappedColumns, updateClickhouseDestinationDraft])

  const handleDeleteRow = useCallback(
    (index: number) => {
      const next = mappedColumns.filter((_, i) => i !== index)
      setMappedColumns(next)
      updateClickhouseDestinationDraft({ mapping: next })
    },
    [mappedColumns, setMappedColumns, updateClickhouseDestinationDraft],
  )

  const handleNullableChange = useCallback(
    (index: number, checked: boolean) => {
      const next = mappedColumns.map((col, i) => {
        if (i !== index) return col
        const baseType = (col.type || 'String').replace(/^Nullable\((.*)\)$/, '$1')
        return {
          ...col,
          isNullable: checked,
          type: checked ? `Nullable(${baseType})` : baseType,
        }
      })
      setMappedColumns(next)
      updateClickhouseDestinationDraft({ mapping: next })
    },
    [mappedColumns, setMappedColumns, updateClickhouseDestinationDraft],
  )

  const existingTableContent = (
    <>
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

      {shouldShowMappingFormExisting && (
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
          duplicateDestinationColumns={validationIssues.duplicateDestinationColumns}
          orderByInvalid={validationIssues.orderByInvalid}
          allowAddMapping
          existingColumnNames={tableSchema.columns.map((c) => c.name)}
          onAddMapping={handleAddMapping}
          onDeleteRow={handleDeleteRow}
          onNullableChange={handleNullableChange}
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
    </>
  )

  return (
    <div className="flex flex-col gap-8 mb-4">
      <div className="space-y-6">
        {allowCreateNewTable ? (
          <Tabs
            value={destinationPath}
            onValueChange={handlePathChange}
            className="w-full"
          >
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-bg-sunken)]">
              <TabsTrigger
                value="create"
                className="data-[state=inactive]:opacity-70 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-[var(--color-border-primary)] data-[state=active]:ring-inset rounded-md border border-transparent data-[state=active]:border-[var(--color-border-primary)]"
              >
                Create New Table
              </TabsTrigger>
              <TabsTrigger
                value="existing"
                className="data-[state=inactive]:opacity-70 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-[var(--color-border-primary)] data-[state=active]:ring-inset rounded-md border border-transparent data-[state=active]:border-[var(--color-border-primary)]"
              >
                Use Existing Table
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-6 mt-0">
              <NewTableSettings
                tableName={tableName}
                onTableNameChange={setTableName}
                availableDatabases={databases}
                selectedDatabase={selectedDatabase}
                setSelectedDatabase={handleDatabaseSelection}
                testDatabaseAccess={testDatabaseAccessWrapper}
                isLoading={isLoading}
                getConnectionConfig={getConnectionConfig}
                onRefreshDatabases={handleRefreshDatabases}
                engine={engine}
                onEngineChange={setEngine}
                orderBy={orderBy}
                onOrderByChange={setOrderBy}
                orderByOptions={orderByOptions}
                readOnly={readOnly}
              />
              {!shouldShowMappingFormCreate && (
                <BatchDelaySelector
                  maxBatchSize={maxBatchSize}
                  maxDelayTime={maxDelayTime}
                  maxDelayTimeUnit={maxDelayTimeUnit}
                  onMaxBatchSizeChange={setMaxBatchSize}
                  onMaxDelayTimeChange={setMaxDelayTime}
                  onMaxDelayTimeUnitChange={setMaxDelayTimeUnit}
                  readOnly={readOnly}
                />
              )}
              {shouldShowMappingFormCreate && (
                <MappingFormSection
                  maxBatchSize={maxBatchSize}
                  maxDelayTime={maxDelayTime}
                  maxDelayTimeUnit={maxDelayTimeUnit}
                  onMaxBatchSizeChange={setMaxBatchSize}
                  onMaxDelayTimeChange={setMaxDelayTime}
                  onMaxDelayTimeUnitChange={setMaxDelayTimeUnit}
                  eventFields={mode === 'single' ? eventFields : [...(primaryEventFields ?? []), ...(secondaryEventFields ?? [])]}
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
                  duplicateDestinationColumns={validationIssues.duplicateDestinationColumns}
                  orderByInvalid={validationIssues.orderByInvalid}
                  isCreatePath
                  onAddMapping={handleAddMapping}
                  onDeleteRow={handleDeleteRow}
                  onNullableChange={handleNullableChange}
                  onRefreshTableSchema={handleRefreshTableSchema}
                  onAutoMap={performAutoMapping}
                  onSubmit={saveDestinationConfig}
                  onDiscard={handleDiscardChanges}
                  selectedDatabase={selectedDatabase}
                  selectedTable={tableName}
                  readOnly={readOnly}
                  isLoading={isLoading}
                  isSuccess={!!success}
                  standalone={standalone}
                  toggleEditMode={toggleEditMode}
                  pipelineActionState={pipelineActionState}
                  onClose={onCompleteStandaloneEditing}
                />
              )}
              {!shouldShowMappingFormCreate && (
                <div className="flex gap-2 mt-4">
                  <FormActions
                    standalone={standalone}
                    onSubmit={saveDestinationConfig}
                    onDiscard={handleDiscardChanges}
                    isLoading={isLoading}
                    isSuccess={!!success}
                    disabled={
                      (destinationPath === 'create' &&
                        (!tableName?.trim() || !selectedDatabase || !engine || !orderBy)) ||
                      isLoading
                    }
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
              )}
            </TabsContent>

            <TabsContent value="existing" className="space-y-6 mt-0">
              {existingTableContent}
            </TabsContent>
          </Tabs>
        ) : (
          existingTableContent
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
