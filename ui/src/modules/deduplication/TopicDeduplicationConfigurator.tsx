'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { StepKeys, TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'
import { useFetchTopics, useFetchEvent } from '@/src/hooks/kafka-mng-hooks'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { KafkaTopicSelectorType } from '@/src/scheme/topics.scheme'
import SelectDeduplicateKeys from '@/src/modules/deduplication/components/SelectDeduplicateKeys'
import EventFetcher from '@/src/components/shared/event-fetcher/EventFetcher'
import { TopicOffsetSelect } from '@/src/modules/kafka/components/TopicOffsetSelect'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { EventDataFormat } from '@/src/config/constants'
import { TopicSelectWithEventPreview } from '@/src/modules/kafka/components/TopicSelectWithEventPreview'

export type TopicDeduplicationConfiguratorProps = {
  steps: any
  onNext: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  index: number
}

export function TopicDeduplicationConfigurator({
  steps,
  onNext,
  validate,
  index = 0,
}: TopicDeduplicationConfiguratorProps) {
  const analytics = useJourneyAnalytics()
  const { topicsStore, kafkaStore } = useStore()
  const {
    availableTopics,
    setAvailableTopics,
    topics: topicsFromStore,
    topicCount: topicCountFromStore,
    addTopic,
    updateTopic,
    getTopic,
    getEvent,
    invalidateTopicDependentState,
  } = topicsStore

  // Get access to the steps store functions
  const { removeCompletedStepsAfter } = useStore()

  // Get existing topic data if available
  const existingTopic = getTopic(index)
  const existingEvent = getEvent(index, 0)

  // Combine the local states into a single object to reduce re-renders
  const [localState, setLocalState] = useState({
    topicName: existingTopic?.name || '',
    offset: (existingTopic?.initialOffset as 'latest' | 'earliest') || INITIAL_OFFSET_OPTIONS.LATEST,
    fetchedEvent: existingEvent?.event || null,
    isLoading: false,
    userInteracted: false,
    canContinue: false,
  })

  // Track if this is the initial render or a return visit
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)

  // Simplified deduplication config state
  const [keyConfig, setKeyConfig] = useState({
    key: existingTopic?.deduplication?.key || '',
    keyType: existingTopic?.deduplication?.keyType || 'string',
  })
  const [windowConfig, setWindowConfig] = useState({
    window: existingTopic?.deduplication?.window || 1,
    unit: existingTopic?.deduplication?.unit || TIME_WINDOW_UNIT_OPTIONS.HOURS.value,
  })
  const [deduplicationConfigured, setDeduplicationConfigured] = useState(
    !!(existingTopic?.deduplication?.key && existingTopic?.deduplication?.window),
  )

  // Check if we're returning to a previously filled form
  const isReturningToForm = existingTopic && existingTopic.name

  // Fetch topics and events
  const { topics: topicsFromKafka, isLoading, error, fetchTopics } = useFetchTopics({ kafka: kafkaStore })

  const { fetchEvent, isLoadingEvent, eventError, event, hasMoreEvents, hasOlderEvents, resetEventState } =
    useFetchEvent(kafkaStore, EventDataFormat.JSON)

  // Add a direct state for the event
  const [currentEvent, setCurrentEvent] = useState<any>(existingEvent?.event || null)

  // Add a ref to track if we've received an event
  const eventReceivedRef = useRef(false)

  // Fetch topics on component mount
  useEffect(() => {
    if (availableTopics.length === 0 && !isLoading) {
      fetchTopics()
    }

    // NOTE: tracking the page view for the topic selection step
    if (index === 0) {
      analytics.page.selectLeftTopic({})
    } else {
      analytics.page.selectRightTopic({})
    }

    // NOTE: Track page view when component loads
    analytics.page.topicDeduplication({})

    // Mark that we're no longer on initial render after the first effect run
    return () => {
      if (isInitialRender) {
        setIsInitialRender(false)
      }
    }
  }, [])

  // Update available topics when they're fetched
  useEffect(() => {
    if (topicsFromKafka.length > 0) {
      setAvailableTopics(topicsFromKafka)
    }
  }, [topicsFromKafka])

  // Handle topic selection
  const handleTopicSelect = async (topic: string, event: any) => {
    if (topic === '') {
      return
    }

    analytics.topic.selected({})

    // If the topic name changed, invalidate dependent state
    if (topic !== localState.topicName) {
      invalidateTopicDependentState(index)

      // Get the current step key based on index and remove all completed steps after it
      const currentStepKey = StepKeys.KAFKA_CONNECTION // We want to remove everything after Kafka connection when topic changes
      removeCompletedStepsAfter(currentStepKey)
    }

    // Update topic in the store with the new event
    updateTopic({
      index: index,
      name: topic,
      initialOffset: localState.offset,
      events: [{ event, topicIndex: index, position: localState.offset }],
      selectedEvent: { event, topicIndex: index, position: localState.offset },
      deduplication: existingTopic?.deduplication || {
        enabled: false,
        window: 0,
        unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
        key: '',
        keyType: '',
      },
    })

    setLocalState((prev) => ({
      ...prev,
      topicName: topic,
      fetchedEvent: event,
    }))
  }

  const handleOffsetChange = (offset: string, event: any) => {
    setLocalState((prev) => ({
      ...prev,
      offset: offset as 'earliest' | 'latest',
    }))

    // Update topic in the store with the new event
    if (event) {
      updateTopic({
        index: index,
        name: localState.topicName,
        initialOffset: offset as 'earliest' | 'latest',
        events: [{ event, topicIndex: index, position: offset as 'earliest' | 'latest' }],
        selectedEvent: { event, topicIndex: index, position: offset as 'earliest' | 'latest' },
        deduplication: existingTopic?.deduplication || {
          enabled: false,
          window: 0,
          unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
          key: '',
          keyType: '',
        },
      })
    }
  }

  // Handle deduplication config changes
  const handleDeduplicationConfigChange = useCallback(
    (newKeyConfig: { key: string; keyType: string }, newWindowConfig: { window: number; unit: string }) => {
      setKeyConfig(newKeyConfig)
      setWindowConfig({
        window: newWindowConfig.window,
        unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      })

      // Update deduplication status
      setDeduplicationConfigured(!!(newKeyConfig.key && newWindowConfig.window))

      analytics.key.dedupKey({
        keyType: newKeyConfig.keyType,
        window: newWindowConfig.window,
        unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      })
    },
    [analytics.key],
  )

  // Update the canContinue logic to include deduplication config
  const canContinue = localState.topicName && existingTopic?.selectedEvent?.event && deduplicationConfigured

  // Determine if we should show validation errors
  const shouldShowValidationErrors = userInteracted || !isInitialRender || isReturningToForm

  // Handle form submission
  const handleSubmit = useCallback(() => {
    // Create deduplication config
    const deduplicationConfig = {
      enabled: true,
      index,
      window: windowConfig.window,
      unit: windowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      key: keyConfig.key,
      keyType: keyConfig.keyType,
    }

    // Update topic in the store with deduplication config
    updateTopic({
      index: index,
      name: existingTopic?.name || '',
      initialOffset: existingTopic?.initialOffset || 'latest',
      events: existingTopic?.events || [],
      selectedEvent: existingTopic?.selectedEvent || {
        topicIndex: index,
        position: existingTopic?.initialOffset || 'latest',
        event: null,
      },
      deduplication: deduplicationConfig,
    })

    // Move to next step
    if (index === 0) {
      onNext(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
    } else {
      onNext(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
    }
  }, [index, existingTopic, windowConfig, keyConfig, updateTopic, onNext])

  // Simplify the event handlers
  const eventHandlers = {
    onEventLoading: () => {
      setLocalState((prev) => ({ ...prev, isLoading: true }))
    },

    onEventLoaded: (eventData: any) => {
      // Make sure we're storing the event data in the correct format
      const formattedEventData = eventData && eventData.event ? eventData : { event: eventData }

      setCurrentEvent(formattedEventData)
      eventReceivedRef.current = true

      setLocalState((prev) => ({
        ...prev,
        fetchedEvent: formattedEventData,
        isLoading: false,
        userInteracted: true,
        canContinue: !!formattedEventData && !!prev.topicName && !!prev.offset,
      }))

      analytics.topic.eventReceived({})
    },

    onEventError: (error: any) => {
      console.error('Event loading error:', error)
      setLocalState((prev) => ({
        ...prev,
        isLoading: false,
        fetchedEvent: null,
        canContinue: false,
      }))

      analytics.topic.eventError({})
    },
  }

  const handleEmptyTopic = () => {
    // FIXME: check this
    setLocalState((prev) => ({
      ...prev,
      canContinue: false,
    }))

    analytics.topic.noEvent({})
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-6 pb-6 bg-background-neutral-faded rounded-md p-0">
        <div className="grid grid-cols-1 gap-6">
          {/* Topic Selection and Event Preview */}
          <TopicSelectWithEventPreview
            index={index}
            existingTopic={existingTopic}
            onTopicChange={handleTopicSelect}
            onOffsetChange={handleOffsetChange}
            availableTopics={availableTopics}
            additionalContent={
              existingTopic?.selectedEvent?.event && (
                <div className="mt-6">
                  <SelectDeduplicateKeys
                    index={index}
                    onChange={handleDeduplicationConfigChange}
                    disabled={!existingTopic?.name}
                    eventData={existingTopic.selectedEvent.event}
                  />
                </div>
              )
            }
          />
        </div>

        {/* Continue Button */}
        <div className="flex justify-between mt-6 px-6">
          <Button variant="gradient" className="btn-text btn-primary" onClick={handleSubmit} disabled={!canContinue}>
            Continue
          </Button>

          {/* Optional: Add a debug indicator for deduplication status */}
          {existingTopic?.name && existingTopic?.selectedEvent?.event && !deduplicationConfigured && (
            <div className="text-amber-500 text-sm">Please configure deduplication settings to continue</div>
          )}
        </div>
      </div>
    </div>
  )
}
