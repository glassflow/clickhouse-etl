'use client'

import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { getTopicStepKeyForValidation, isTopicDeduplicationStep } from '@/src/modules/kafka/utils/topicStepKeys'
import { TopicSelectWithEventPreview } from '@/src/modules/kafka/components/TopicSelectWithEventPreview'
import FormActions from '@/src/components/shared/FormActions'
import SelectDeduplicateKeys from '@/src/modules/deduplication/components/SelectDeduplicateKeys'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import { TopicSelectorProps } from '@/src/modules/kafka/types'
import useGetIndex from '@/src/modules/kafka/useGetIndex'
import { useKafkaTopicSelectorState } from '@/src/modules/kafka/hooks/useKafkaTopicSelectorState'
import { useTopicSelectorTopics } from '@/src/modules/kafka/hooks/useTopicSelectorTopics'
import TopicChangeConfirmationModal from '@/src/modules/kafka/components/TopicChangeConfirmationModal'

export function KafkaTopicSelector({
  steps,
  onCompleteStep,
  validate,
  currentStep,
  readOnly,
  standalone,
  toggleEditMode,
  enableDeduplication = false,
  onDeduplicationChange,
  initialDeduplicationConfig,
  pipelineActionState,
  onCompleteStandaloneEditing,
}: TopicSelectorProps) {
  const { topicsStore, coreStore } = useStore()
  const validationEngine = useValidationEngine()
  const getIndex = useGetIndex(currentStep || '')
  const index = getIndex()
  const { topics: topicsFromStore } = topicsStore
  const storedTopic = topicsFromStore[index]

  const topicSelectorState = useKafkaTopicSelectorState({
    index,
    enableDeduplication,
    onDeduplicationChange,
    initialDeduplicationConfig,
    currentStep,
  })

  const {
    topicName,
    offset,
    event,
    isLoading,
    isEmptyTopic,
    error,
    deduplicationConfig,
    deduplicationConfigured,
    canContinue,
    manualEvent,
    isManualEventValid,
    replicas,
    partitionCount,
    selectTopic,
    selectOffset,
    selectReplicaCount,
    updatePartitionCount,
    configureDeduplication,
    handleManualEventChange,
    submit,
    currentOffset,
    earliestOffset,
    latestOffset,
    isAtLatest,
    isAtEarliest,
    fetchNewestEvent,
    fetchOldestEvent,
    fetchNextEvent,
    fetchPreviousEvent,
    refreshEvent,
  } = topicSelectorState

  const { availableTopics, fetchTopics, getPartitionCount } = useTopicSelectorTopics({
    topicName,
    partitionCount,
    replicas,
    updatePartitionCount,
    selectReplicaCount,
  })

  // State for tracking save success in edit mode
  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  // State for topic change confirmation modal
  const [isTopicChangeModalVisible, setIsTopicChangeModalVisible] = useState(false)
  const [pendingTopicChange, setPendingTopicChange] = useState<string | null>(null)

  // Reset success state when user starts editing again
  useEffect(() => {
    if (!readOnly && isSaveSuccess) {
      setIsSaveSuccess(false)
    }
  }, [readOnly, isSaveSuccess])

  // Apply partition count to replica when topic changes (single place for this rule)
  const applyPartitionCountToReplica = useCallback(
    (newTopicName: string) => {
      const count = getPartitionCount(newTopicName)
      if (count > 0) {
        selectReplicaCount(count)
      }
    },
    [getPartitionCount, selectReplicaCount],
  )

  // Handle topic change using the hook
  const handleTopicChange = useCallback(
    (newTopicName: string, event: any) => {
      const isEditMode = standalone && !readOnly
      const isTopicChanging = storedTopic?.name && newTopicName !== storedTopic.name

      if (isEditMode && isTopicChanging) {
        setPendingTopicChange(newTopicName)
        setIsTopicChangeModalVisible(true)
      } else {
        selectTopic(newTopicName)
        applyPartitionCountToReplica(newTopicName)
      }
    },
    [selectTopic, applyPartitionCountToReplica, standalone, readOnly, storedTopic?.name],
  )

  // Handle confirmation of topic change
  const handleConfirmTopicChange = useCallback(() => {
    if (pendingTopicChange) {
      selectTopic(pendingTopicChange)
      applyPartitionCountToReplica(pendingTopicChange)
    }
    setIsTopicChangeModalVisible(false)
    setPendingTopicChange(null)
  }, [pendingTopicChange, selectTopic, applyPartitionCountToReplica])

  // Handle cancellation of topic change
  const handleCancelTopicChange = useCallback(() => {
    // User cancelled - just close modal and clear pending change
    setIsTopicChangeModalVisible(false)
    setPendingTopicChange(null)
  }, [])

  // Handle offset change using the hook
  const handleOffsetChange = useCallback(
    (offset: 'earliest' | 'latest', event: any) => {
      // Use the hook's offset selection
      selectOffset(offset)
    },
    [selectOffset],
  )

  // Enhanced form submission handler using the hook
  const handleSubmit = useCallback(() => {
    submit()

    const stepKey = getTopicStepKeyForValidation(currentStep ?? '')
    const isEditMode = standalone && toggleEditMode

    if (isEditMode) {
      if (stepKey) {
        validationEngine.markSectionAsValid(stepKey)
      }
      coreStore.markAsDirty()
      onCompleteStandaloneEditing?.()
    } else {
      onCompleteStep(stepKey ?? currentStep ?? StepKeys.TOPIC_SELECTION_1)
    }
  }, [
    submit,
    currentStep,
    validationEngine,
    onCompleteStep,
    onCompleteStandaloneEditing,
    standalone,
    toggleEditMode,
    coreStore,
  ])

  // Enhanced form submission handler with success state
  const handleSubmitWithSuccess = useCallback(() => {
    handleSubmit()

    // Set success state for edit mode to trigger UI feedback and form closure
    if (standalone && toggleEditMode) {
      setIsSaveSuccess(true)
      // Don't reset success state - let it stay true to keep the form closed
      // The success state will be reset when the user starts editing again
    }
  }, [handleSubmit, standalone, toggleEditMode])

  // Handle refresh topics
  const handleRefreshTopics = useCallback(async () => {
    await fetchTopics()
  }, [fetchTopics])

  // Handle discard changes for this section
  const handleDiscardChanges = useCallback(() => {
    const sectionsToDiscard = isTopicDeduplicationStep(currentStep ?? '') ? ['topics', 'deduplication'] : ['topics']
    coreStore.discardSections(sectionsToDiscard)
  }, [coreStore, currentStep])

  const renderDeduplicationSection = () => {
    if (!enableDeduplication) return null

    const eventData = event || (manualEvent && isManualEventValid ? JSON.parse(manualEvent) : null)

    if (!eventData) return null

    return (
      <div className="mt-6">
        <SelectDeduplicateKeys
          index={index}
          onChange={configureDeduplication}
          disabled={!topicName}
          eventData={eventData}
          readOnly={readOnly}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-6 bg-background-neutral-faded rounded-md p-0">
        <div className="grid grid-cols-1 gap-6">
          <TopicSelectWithEventPreview
            index={index}
            existingTopic={storedTopic}
            onTopicChange={handleTopicChange}
            onOffsetChange={handleOffsetChange}
            onManualEventChange={handleManualEventChange}
            availableTopics={availableTopics}
            additionalContent={renderDeduplicationSection()}
            isEditingEnabled={!readOnly}
            readOnly={readOnly}
            disableTopicChange={false} // Allow topic selection in edit mode to enable topic changes
            topicName={topicName}
            offset={offset}
            event={event}
            isLoading={isLoading}
            error={error}
            currentOffset={currentOffset}
            earliestOffset={earliestOffset}
            latestOffset={latestOffset}
            isAtLatest={isAtLatest}
            isAtEarliest={isAtEarliest}
            fetchNewestEvent={fetchNewestEvent}
            fetchOldestEvent={fetchOldestEvent}
            fetchNextEvent={fetchNextEvent}
            fetchPreviousEvent={fetchPreviousEvent}
            refreshEvent={refreshEvent}
            partitionCount={partitionCount}
            replicas={replicas}
            onReplicaCountChange={selectReplicaCount}
            onRefreshTopics={handleRefreshTopics}
          />
        </div>

        <FormActions
          standalone={standalone}
          onSubmit={handleSubmitWithSuccess}
          onDiscard={handleDiscardChanges}
          isLoading={false}
          isSuccess={isSaveSuccess}
          disabled={!canContinue}
          successText="Continue"
          loadingText="Loading..."
          regularText="Continue"
          actionType="primary"
          showLoadingIcon={false}
          readOnly={readOnly}
          toggleEditMode={toggleEditMode}
          pipelineActionState={pipelineActionState}
          onClose={onCompleteStandaloneEditing}
        />

        {/* NEW: Optional debug indicator for deduplication status */}
        {Boolean(enableDeduplication && topicName && event && !deduplicationConfigured) && (
          <div className="text-amber-500 text-sm px-6">Please configure deduplication settings to continue</div>
        )}
      </div>

      {/* Topic Change Confirmation Modal */}
      <TopicChangeConfirmationModal
        visible={isTopicChangeModalVisible}
        onOk={handleConfirmTopicChange}
        onCancel={handleCancelTopicChange}
        newTopicName={pendingTopicChange || ''}
        operationType={coreStore.topicCount === 2 ? 'join' : 'ingest'}
      />
    </div>
  )
}
