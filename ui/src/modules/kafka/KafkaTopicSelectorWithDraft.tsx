'use client'

import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { useFetchTopics } from '@/src/hooks/useFetchKafkaTopics'
import { TopicSelectWithEventPreview } from '@/src/modules/kafka/components/TopicSelectWithEventPreview'
import FormActions from '@/src/components/shared/FormActions'
import SelectDeduplicateKeys from '@/src/modules/deduplication/components/SelectDeduplicateKeys'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import { TopicSelectorProps } from '@/src/modules/kafka/types'
import useGetIndex from '@/src/modules/kafka/useGetIndex'
import { useKafkaTopicSelectorState } from '@/src/modules/kafka/hooks/useKafkaTopicSelectorState'
import { useDraftManager } from '@/src/hooks/useDraftManager'
import { DraftModeActions, InlineDraftActions } from '@/src/components/shared/DraftModeActions'

export function KafkaTopicSelectorWithDraft({
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
  const { topicsStore, kafkaStore } = useStore()
  const validationEngine = useValidationEngine()
  const { topics: topicsFromKafka, isLoadingTopics, topicsError, fetchTopics } = useFetchTopics({ kafka: kafkaStore })
  const getIndex = useGetIndex(currentStep || '')

  const {
    availableTopics,
    setAvailableTopics,
    topics: topicsFromStore,
    topicCount: topicCountFromStore,
    updateTopic,
    invalidateTopicDependentState,
  } = topicsStore

  const index = getIndex()

  // Get existing topic data if available
  const storedTopic = topicsFromStore[index]
  const effectiveTopic = storedTopic

  const [topicFetchAttempts, setTopicFetchAttempts] = useState(0)
  const [isInitialRender, setIsInitialRender] = useState(true)

  // Draft management
  const draftManager = useDraftManager({
    stepKey: currentStep || StepKeys.TOPIC_SELECTION_1,
    onCommit: (changes) => {
      console.log('✅ Draft changes committed:', changes)
      // Trigger validation engine
      if (currentStep) {
        validationEngine.onSectionConfigured(currentStep as StepKeys)
      }
    },
    onDiscard: () => {
      console.log('❌ Draft changes discarded')
    },
  })

  // Use the new hook for all topic selection logic
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
    isDraftMode: hookDraftMode,
    manualEvent,
    isManualEventValid,
    selectTopic,
    selectOffset,
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
  } = useKafkaTopicSelectorState({
    index,
    enableDeduplication,
    onDeduplicationChange,
    initialDeduplicationConfig,
    currentStep,
  })

  // ================================ EFFECTS ================================

  // Fetch topics on component mount
  useEffect(() => {
    if (availableTopics.length === 0 && !isLoadingTopics && topicFetchAttempts < 3) {
      setTopicFetchAttempts((prev) => prev + 1)
      fetchTopics()
    }

    if (isInitialRender) {
      setIsInitialRender(false)
    }
  }, [availableTopics.length, fetchTopics, isLoadingTopics, isInitialRender, topicFetchAttempts])

  // Update available topics when topics are fetched
  useEffect(() => {
    if (topicsFromKafka.length > 0) {
      setAvailableTopics(topicsFromKafka)
    }
  }, [topicsFromKafka, setAvailableTopics])

  // State for tracking save success in edit mode
  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  // Reset success state when user starts editing again
  useEffect(() => {
    if (!readOnly && isSaveSuccess) {
      setIsSaveSuccess(false)
    }
  }, [readOnly, isSaveSuccess])

  // ================================ HANDLERS ================================

  // Handle topic change using the hook
  const handleTopicChange = useCallback(
    (topicName: string, event: any) => {
      selectTopic(topicName)
    },
    [selectTopic],
  )

  // Handle offset change using the hook
  const handleOffsetChange = useCallback(
    (offset: 'earliest' | 'latest', event: any) => {
      selectOffset(offset)
    },
    [selectOffset],
  )

  // Enhanced form submission handler
  const handleSubmit = useCallback(() => {
    // If in draft mode, commit the draft
    if (draftManager.isDraftMode) {
      draftManager.commitDraft()
      setIsSaveSuccess(true)
      onCompleteStandaloneEditing?.()
      return
    }

    // Otherwise, use the normal submit flow
    submit()

    const isEditMode = standalone && toggleEditMode

    if (isEditMode) {
      if (currentStep === StepKeys.TOPIC_SELECTION_1) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_SELECTION_1)
      } else if (currentStep === StepKeys.TOPIC_SELECTION_2) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_SELECTION_2)
      } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
      } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
      } else {
        validationEngine.onSectionConfigured((currentStep as StepKeys) || StepKeys.TOPIC_SELECTION_1)
      }

      onCompleteStandaloneEditing?.()
    } else {
      if (currentStep === StepKeys.TOPIC_SELECTION_1) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_SELECTION_1)
        onCompleteStep(StepKeys.TOPIC_SELECTION_1)
      } else if (currentStep === StepKeys.TOPIC_SELECTION_2) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_SELECTION_2)
        onCompleteStep(StepKeys.TOPIC_SELECTION_2)
      } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
        onCompleteStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
      } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
        onCompleteStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
      } else {
        validationEngine.onSectionConfigured((currentStep as StepKeys) || StepKeys.TOPIC_SELECTION_1)
        onCompleteStep(currentStep || StepKeys.TOPIC_SELECTION_1)
      }
    }
  }, [
    submit,
    currentStep,
    validationEngine,
    onCompleteStep,
    standalone,
    toggleEditMode,
    draftManager,
    onCompleteStandaloneEditing,
  ])

  // Enhanced form submission handler with success state
  const handleSubmitWithSuccess = useCallback(() => {
    handleSubmit()

    if (standalone && toggleEditMode) {
      setIsSaveSuccess(true)
    }
  }, [handleSubmit, standalone, toggleEditMode])

  // NEW: Conditional rendering for deduplication section
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

  // Determine if we should show draft mode UI
  const shouldShowDraftMode = standalone && !readOnly

  return (
    <div className="space-y-6 w-full">
      {/* Draft Mode Actions */}
      {shouldShowDraftMode && (
        <div className="flex justify-end mb-4">
          <DraftModeActions
            isDraftMode={draftManager.isDraftMode}
            hasChanges={draftManager.hasChanges}
            onEnterDraftMode={draftManager.enterDraftMode}
            onCommitDraft={draftManager.commitDraft}
            onDiscardDraft={draftManager.discardDraft}
            disabled={pipelineActionState?.isLoading}
          />
        </div>
      )}

      <div className="flex flex-col gap-6 pb-6 bg-background-neutral-faded rounded-md p-0">
        <div className="grid grid-cols-1 gap-6">
          <TopicSelectWithEventPreview
            index={index}
            existingTopic={effectiveTopic}
            onTopicChange={handleTopicChange}
            onOffsetChange={handleOffsetChange}
            onManualEventChange={handleManualEventChange}
            availableTopics={availableTopics}
            additionalContent={renderDeduplicationSection()}
            isEditingEnabled={manualEvent !== '' || effectiveTopic?.selectedEvent?.isManualEvent || false}
            readOnly={readOnly}
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
          />
        </div>

        {/* Inline Draft Actions (when in draft mode) */}
        {draftManager.isDraftMode && (
          <div className="flex justify-end px-6">
            <InlineDraftActions
              isDraftMode={draftManager.isDraftMode}
              hasChanges={draftManager.hasChanges}
              onCommitDraft={draftManager.commitDraft}
              onDiscardDraft={draftManager.discardDraft}
              onResetDraft={draftManager.resetDraft}
              disabled={pipelineActionState?.isLoading}
            />
          </div>
        )}

        {/* Original Form Actions (when not in draft mode) */}
        {!draftManager.isDraftMode && (
          <FormActions
            standalone={standalone}
            onSubmit={handleSubmitWithSuccess}
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
          />
        )}

        {/* NEW: Optional debug indicator for deduplication status */}
        {enableDeduplication && topicName && event && !deduplicationConfigured && (
          <div className="text-amber-500 text-sm px-6">Please configure deduplication settings to continue</div>
        )}

        {/* Draft Mode Status Indicator */}
        {draftManager.isDraftMode && (
          <div className="bg-blue-50 border border-blue-200 p-4 mx-6 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-blue-800 text-sm font-medium">Draft Mode Active</span>
              </div>
              {draftManager.hasChanges && <span className="text-blue-600 text-sm">Unsaved changes</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
