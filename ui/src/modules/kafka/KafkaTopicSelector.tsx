'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useStore } from '@/src/store'
import { TIME_WINDOW_UNIT_OPTIONS, OperationKeys } from '@/src/config/constants'
import { StepKeys } from '@/src/config/constants'
import { useFetchTopics } from '@/src/hooks/useFetchKafkaTopics'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { TopicSelectWithEventPreview } from '@/src/modules/kafka/components/TopicSelectWithEventPreview'
import { EventManagerContextProvider } from '../../components/shared/event-fetcher/EventManagerContext'
import FormActions from '@/src/components/shared/FormActions'
import SelectDeduplicateKeys from '@/src/modules/deduplication/components/SelectDeduplicateKeys'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'

// Type definitions for deduplication config
export type DeduplicationConfig = {
  enabled: boolean
  window: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
  key: string
  keyType: string
}

export type TopicSelectorProps = {
  steps: any
  onCompleteStep: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  currentStep?: string
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  // NEW: Deduplication-specific props
  enableDeduplication?: boolean
  onDeduplicationChange?: (config: DeduplicationConfig) => void
  initialDeduplicationConfig?: Partial<DeduplicationConfig>
}

export function KafkaTopicSelector({
  steps,
  onCompleteStep,
  validate,
  currentStep,
  readOnly,
  standalone,
  toggleEditMode,
  // NEW: Deduplication props with defaults
  enableDeduplication = false,
  onDeduplicationChange,
  initialDeduplicationConfig,
}: TopicSelectorProps) {
  const { topicsStore, kafkaStore, joinStore, configStore } = useStore()
  const validationEngine = useValidationEngine()
  const { operationsSelected } = configStore

  console.log('KafkaTopicSelector currentStep', currentStep)

  // Determine index based on current step (more reliable than operationsSelected during editing)
  const getIndex = useCallback(() => {
    if (!currentStep) return 0

    // Determine index based on step name, which is more reliable during editing
    if (currentStep === StepKeys.TOPIC_SELECTION_1 || currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
      return 0 // Left topic (first topic)
    } else if (
      currentStep === StepKeys.TOPIC_SELECTION_2 ||
      currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
    ) {
      return 1 // Right topic (second topic)
    }

    // For any other step, default to index 0
    return 0
  }, [currentStep])

  const index = getIndex()
  console.log('KafkaTopicSelector index', index)
  console.log('KafkaTopicSelector operationsSelected', operationsSelected)
  console.log('KafkaTopicSelector currentStep', currentStep)

  const { topics: topicsFromKafka, isLoadingTopics, topicsError, fetchTopics } = useFetchTopics({ kafka: kafkaStore })
  const analytics = useJourneyAnalytics()

  const {
    availableTopics,
    setAvailableTopics,
    topics: topicsFromStore,
    topicCount: topicCountFromStore,
    updateTopic,
    invalidateTopicDependentState,
  } = topicsStore

  // Get existing topic data if available
  const storedTopic = topicsFromStore[index]
  const storedTopicName = storedTopic?.name
  const storedEvent = storedTopic?.selectedEvent?.event
  const initialOffset = storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST

  // Use stored topic data
  const effectiveTopic = storedTopic
  const effectiveTopicName = effectiveTopic?.name
  const effectiveEvent = effectiveTopic?.selectedEvent?.event
  const effectiveOffset = effectiveTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST
  const [topicFetchAttempts, setTopicFetchAttempts] = useState(0)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isManualEventValid, setIsManualEventValid] = useState(false)
  const [manualEvent, setManualEvent] = useState('')
  const [localTopicName, setLocalTopicName] = useState(effectiveTopicName || '')
  const [localOffset, setLocalOffset] = useState<'earliest' | 'latest'>(
    (effectiveOffset as 'latest' | 'earliest') || INITIAL_OFFSET_OPTIONS.LATEST,
  )

  // NEW: Deduplication state management
  // Get deduplication config from the new separated store
  const deduplicationStore = useStore((state) => state.deduplicationStore)
  const storedDeduplicationConfig = deduplicationStore.getDeduplication(index)

  const [deduplicationConfig, setDeduplicationConfig] = useState<{
    key: string
    keyType: string
    window: number
    unit: 'seconds' | 'minutes' | 'hours' | 'days'
  }>({
    key: initialDeduplicationConfig?.key || storedDeduplicationConfig?.key || '',
    keyType: initialDeduplicationConfig?.keyType || storedDeduplicationConfig?.keyType || 'string',
    window: initialDeduplicationConfig?.window || storedDeduplicationConfig?.window || 1,
    unit:
      initialDeduplicationConfig?.unit ||
      storedDeduplicationConfig?.unit ||
      (TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days'),
  })

  const [deduplicationConfigured, setDeduplicationConfigured] = useState(
    !!(initialDeduplicationConfig?.key || (storedDeduplicationConfig?.key && storedDeduplicationConfig?.window)),
  )

  const handleManualEventChange = (event: string) => {
    setManualEvent(event)
    try {
      JSON.parse(event)
      setIsManualEventValid(true)
    } catch (error) {
      setIsManualEventValid(false)
    }
  }

  // NEW: Handle deduplication config changes
  const handleDeduplicationConfigChange = useCallback(
    (newKeyConfig: { key: string; keyType: string }, newWindowConfig: { window: number; unit: string }) => {
      const updatedConfig = {
        key: newKeyConfig.key,
        keyType: newKeyConfig.keyType,
        window: newWindowConfig.window,
        unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      }

      setDeduplicationConfig(updatedConfig)

      // Update deduplication status
      const isConfigured = !!(newKeyConfig.key && newWindowConfig.window)
      setDeduplicationConfigured(isConfigured)

      // Notify parent component if callback provided
      if (onDeduplicationChange) {
        onDeduplicationChange({
          enabled: isConfigured,
          ...updatedConfig,
        })
      }

      // Analytics tracking for deduplication
      if (isConfigured) {
        analytics.key.dedupKey({
          keyType: newKeyConfig.keyType,
          window: newWindowConfig.window,
          unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
        })
      }
    },
    [onDeduplicationChange, analytics.key],
  )

  // NEW: Enhanced validation logic that includes deduplication requirements
  const canContinue = useMemo(() => {
    const hasValidTopic = localTopicName && (storedEvent || (manualEvent && isManualEventValid))

    if (!enableDeduplication) {
      return hasValidTopic
    }

    // For deduplication mode, also require deduplication config
    return hasValidTopic && deduplicationConfigured
  }, [localTopicName, storedEvent, manualEvent, isManualEventValid, enableDeduplication, deduplicationConfigured])

  // ================================ EFFECTS ================================

  // Validate manual event - enable continue button only if the manual event is valid
  useEffect(() => {
    if (manualEvent) {
      try {
        JSON.parse(manualEvent)
        setIsManualEventValid(true)
      } catch (error) {
        setIsManualEventValid(false)
      }
    } else {
      setIsManualEventValid(false)
    }
  }, [manualEvent])

  // Track page view when component loads - depending on the step, we want to track the topic selection differently
  useEffect(() => {
    // Determine if this is a join operation based on step name (more reliable than operationsSelected)
    const isJoinOperation =
      currentStep === StepKeys.TOPIC_SELECTION_2 || currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2

    if (isJoinOperation) {
      if (index === 0) {
        analytics.page.selectLeftTopic({})
      } else {
        analytics.page.selectRightTopic({})
      }
    } else {
      analytics.page.selectTopic({})
    }

    // NEW: Track deduplication page view if enabled
    if (enableDeduplication) {
      analytics.page.topicDeduplication({})
    }
  }, [enableDeduplication, index, currentStep, analytics.page])

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

  // Update local state when topic name changes
  useEffect(() => {
    if (storedTopicName && !isInitialRender) {
      // Skip if we're just setting the initial value or there's no actual change
      if (storedTopicName === '' || storedTopicName === localTopicName) return

      // Clear join store whenever topic name changes
      joinStore.setEnabled(false)
      joinStore.setType('')
      joinStore.setStreams([])

      setLocalTopicName(storedTopicName)
      setManualEvent('')
      setIsManualEventValid(false)
    }
  }, [storedTopicName, localTopicName, isInitialRender, joinStore])

  // Update local state when offset changes
  useEffect(() => {
    if (initialOffset && !isInitialRender) {
      // Skip if there's no actual change to avoid loops
      if (initialOffset === localOffset) return

      setLocalOffset(initialOffset)
    }
  }, [initialOffset, isInitialRender, localOffset])

  // ================================ HANDLERS ================================

  // Handle topic change
  const handleTopicChange = (topicName: string, event: any) => {
    // If the topic name changed, invalidate dependent state
    if (topicName !== storedTopic?.name) {
      invalidateTopicDependentState(index)

      // Clear join store configuration
      joinStore.setEnabled(false)
      joinStore.setType('')
      joinStore.setStreams([])
    }

    // Create base deduplication config
    const baseDeduplicationConfig = {
      enabled: false,
      window: 0,
      unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
      key: '',
      keyType: '',
    }

    // Use existing deduplication config if available, otherwise use base config
    const deduplicationToUse =
      enableDeduplication && deduplicationConfigured
        ? {
            enabled: true,
            window: deduplicationConfig.window,
            unit: deduplicationConfig.unit,
            key: deduplicationConfig.key,
            keyType: deduplicationConfig.keyType,
          }
        : storedDeduplicationConfig || baseDeduplicationConfig

    // Create topic data
    const topicData = {
      index: index,
      name: topicName,
      initialOffset: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
      events: event
        ? [
            {
              event,
              topicIndex: index,
              position: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
            },
          ]
        : [],
      selectedEvent: event
        ? {
            event,
            topicIndex: index,
            position: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
          }
        : {
            event: undefined,
            topicIndex: index,
            position: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
          },
    }

    // Update topic in the store (without deduplication)
    updateTopic(topicData)
    // Update deduplication store separately
    deduplicationStore.updateDeduplication(index, deduplicationToUse)

    setLocalTopicName(topicName)

    analytics.topic.selected({
      offset: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
    })
  }

  // Handle offset change
  const handleOffsetChange = useCallback(
    (offset: 'earliest' | 'latest', event: any) => {
      // Create base deduplication config
      const baseDeduplicationConfig = {
        enabled: false,
        window: 0,
        unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
        key: '',
        keyType: '',
      }

      // Use existing deduplication config if available, otherwise use base config
      const deduplicationToUse =
        enableDeduplication && deduplicationConfigured
          ? {
              enabled: true,
              window: deduplicationConfig.window,
              unit: deduplicationConfig.unit,
              key: deduplicationConfig.key,
              keyType: deduplicationConfig.keyType,
            }
          : storedDeduplicationConfig || baseDeduplicationConfig

      // Create topic data
      const topicData = {
        index: index,
        name: storedTopic?.name || '',
        initialOffset: offset,
        events: [
          {
            event,
            topicIndex: index,
            position: offset,
          },
        ],
        selectedEvent: {
          event,
          topicIndex: index,
          position: offset,
        },
      }

      // Update topic with new offset and event (without deduplication)
      updateTopic(topicData)
      // Update deduplication store separately
      deduplicationStore.updateDeduplication(index, deduplicationToUse)

      setLocalOffset(offset)
    },
    [
      index,
      storedTopic,
      updateTopic,
      enableDeduplication,
      deduplicationConfigured,
      deduplicationConfig,
      deduplicationStore,
    ],
  )

  // NEW: Enhanced form submission handler that includes deduplication config
  const handleSubmit = useCallback(() => {
    let event = null

    try {
      // if there's no event in the store, use the manual event
      event = (manualEvent ? JSON.parse(manualEvent) : null) || storedEvent
    } catch (e) {
      console.error('Error parsing event:', e)
      return
    }

    // Create base topic data
    const baseTopicData = {
      index: index,
      name: localTopicName,
      initialOffset: localOffset,
      events: [{ event: event, topicIndex: index, position: localOffset, isManualEvent: manualEvent !== '' }],
      selectedEvent: {
        event: event,
        topicIndex: index,
        position: localOffset,
        isManualEvent: manualEvent !== '',
      },
    }

    // Create deduplication config based on mode
    const deduplicationData =
      enableDeduplication && deduplicationConfigured
        ? {
            enabled: true,
            window: deduplicationConfig.window,
            unit: deduplicationConfig.unit,
            key: deduplicationConfig.key,
            keyType: deduplicationConfig.keyType,
          }
        : storedDeduplicationConfig || {
            enabled: false,
            window: 0,
            unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
            key: '',
            keyType: '',
          }

    // Update topic without deduplication
    updateTopic(baseTopicData)

    // Update deduplication store separately
    deduplicationStore.updateDeduplication(index, deduplicationData)

    // Trigger validation engine to mark this section as valid and invalidate dependents
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
      // Fallback for any other topic selection step
      validationEngine.onSectionConfigured((currentStep as StepKeys) || StepKeys.TOPIC_SELECTION_1)
      onCompleteStep(currentStep || StepKeys.TOPIC_SELECTION_1)
    }
  }, [
    index,
    onCompleteStep,
    topicCountFromStore,
    manualEvent,
    localTopicName,
    localOffset,
    storedEvent,
    storedDeduplicationConfig,
    updateTopic,
    currentStep,
    enableDeduplication,
    deduplicationConfigured,
    deduplicationConfig,
    deduplicationStore,
  ])

  // NEW: Conditional rendering for deduplication section
  const renderDeduplicationSection = () => {
    if (!enableDeduplication) return null

    const eventData = storedEvent || (manualEvent && isManualEventValid ? JSON.parse(manualEvent) : null)

    if (!eventData) return null

    return (
      <div className="mt-6">
        <SelectDeduplicateKeys
          index={index}
          onChange={handleDeduplicationConfigChange}
          disabled={!localTopicName}
          eventData={eventData}
          readOnly={readOnly}
        />
      </div>
    )
  }

  return (
    <EventManagerContextProvider>
      <div className="space-y-6 w-full">
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
            />
          </div>

          <FormActions
            standalone={standalone}
            onSubmit={handleSubmit}
            isLoading={false}
            isSuccess={false}
            disabled={!canContinue}
            successText="Continue"
            loadingText="Loading..."
            regularText="Continue"
            actionType="primary"
            showLoadingIcon={false}
            readOnly={readOnly}
            toggleEditMode={toggleEditMode}
          />

          {/* NEW: Optional debug indicator for deduplication status */}
          {enableDeduplication && localTopicName && storedEvent && !deduplicationConfigured && (
            <div className="text-amber-500 text-sm px-6">Please configure deduplication settings to continue</div>
          )}
        </div>
      </div>
    </EventManagerContextProvider>
  )
}
