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
  const { topicsStore, kafkaStore, coreStore } = useStore()
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

  const [topicFetchAttempts, setTopicFetchAttempts] = useState(0)
  const [isInitialRender, setIsInitialRender] = useState(true)

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

  // Fetch topics on component mount
  useEffect(() => {
    if (availableTopics.length === 0 && !isLoadingTopics && topicFetchAttempts < 3) {
      setTopicFetchAttempts((prev) => prev + 1)
      fetchTopics()
    }

    // Mark that we're no longer on initial render after the first effect run
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

  // Handle topic change using the hook
  const handleTopicChange = useCallback(
    (topicName: string, event: any) => {
      // Use the hook's topic selection
      selectTopic(topicName)
    },
    [selectTopic],
  )

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
    // Use the hook's submit function to persist changes
    submit()

    // Check if we're in edit mode (standalone with toggleEditMode)
    const isEditMode = standalone && toggleEditMode

    if (isEditMode) {
      // In edit mode, just save changes and trigger validation engine
      // Don't call onCompleteStep as we want to stay in the same section
      if (currentStep === StepKeys.TOPIC_SELECTION_1) {
        console.log('Kafka Topic Selector: In edit mode, step 1')
        validationEngine.onSectionConfigured(StepKeys.TOPIC_SELECTION_1)
      } else if (currentStep === StepKeys.TOPIC_SELECTION_2) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_SELECTION_2)
      } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
      } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
        validationEngine.onSectionConfigured(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
      } else {
        // Fallback for any other topic selection step
        validationEngine.onSectionConfigured((currentStep as StepKeys) || StepKeys.TOPIC_SELECTION_1)
      }

      onCompleteStandaloneEditing?.()
    } else {
      // In creation mode, just move to next step
      if (currentStep === StepKeys.TOPIC_SELECTION_1) {
        // validationEngine.onSectionConfigured(StepKeys.TOPIC_SELECTION_1)
        onCompleteStep(StepKeys.TOPIC_SELECTION_1)
      } else if (currentStep === StepKeys.TOPIC_SELECTION_2) {
        // validationEngine.onSectionConfigured(StepKeys.TOPIC_SELECTION_2)
        onCompleteStep(StepKeys.TOPIC_SELECTION_2)
      } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
        // validationEngine.onSectionConfigured(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
        onCompleteStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
      } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
        // validationEngine.onSectionConfigured(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
        onCompleteStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
      } else {
        // Fallback for any other topic selection step
        // validationEngine.onSectionConfigured((currentStep as StepKeys) || StepKeys.TOPIC_SELECTION_1)
        onCompleteStep(currentStep || StepKeys.TOPIC_SELECTION_1)
      }
    }
  }, [submit, currentStep, validationEngine, onCompleteStep, standalone, toggleEditMode])

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

  // Handle discard changes for this section
  const handleDiscardChanges = useCallback(() => {
    // Determine which sections to discard based on the current step
    let sectionsToDiscard: string[] = ['topics']

    if (
      currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 ||
      currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
    ) {
      // For deduplication configurator steps, discard both topics and deduplication
      sectionsToDiscard = ['topics', 'deduplication']
    }

    // Discard all sections at once
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
      <div className="flex flex-col gap-6 pb-6 bg-background-neutral-faded rounded-md p-0">
        <div className="grid grid-cols-1 gap-6">
          <TopicSelectWithEventPreview
            index={index}
            existingTopic={storedTopic}
            onTopicChange={handleTopicChange}
            onOffsetChange={handleOffsetChange}
            onManualEventChange={handleManualEventChange}
            availableTopics={availableTopics}
            additionalContent={renderDeduplicationSection()}
            isEditingEnabled={manualEvent !== '' || storedTopic?.selectedEvent?.isManualEvent || false}
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
        />

        {/* NEW: Optional debug indicator for deduplication status */}
        {enableDeduplication && topicName && event && !deduplicationConfigured && (
          <div className="text-amber-500 text-sm px-6">Please configure deduplication settings to continue</div>
        )}
      </div>
    </div>
  )
}
