'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { TIME_WINDOW_UNIT_OPTIONS, OperationKeys } from '@/src/config/constants'
import { StepKeys } from '@/src/config/constants'
import { useFetchTopics } from '../../hooks/kafka-mng-hooks'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { TopicSelectWithEventPreview } from '@/src/modules/kafka/components/TopicSelectWithEventPreview'
import { EventFetchProvider } from '../../components/shared/event-fetcher/EventFetchContext'

export type TopicSelectorProps = {
  steps: any
  onCompleteStep: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  currentStep?: string
}

export function KafkaTopicSelector({ steps, onCompleteStep, validate, currentStep }: TopicSelectorProps) {
  const { topicsStore, kafkaStore, joinStore, operationsSelected } = useStore()

  // Determine index based on current step and operation
  const getIndex = useCallback(() => {
    if (!currentStep) return 0

    // For join operations, determine if this is the first or second topic selection
    if (
      operationsSelected?.operation === OperationKeys.JOINING ||
      operationsSelected?.operation === OperationKeys.DEDUPLICATION_JOINING
    ) {
      if (currentStep === StepKeys.TOPIC_SELECTION_1 || currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
        return 0 // Left topic
      } else if (
        currentStep === StepKeys.TOPIC_SELECTION_2 ||
        currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
      ) {
        return 1 // Right topic
      }
    }

    // For non-join operations, always use index 0
    return 0
  }, [currentStep, operationsSelected?.operation])

  const index = getIndex()

  const {
    topics: topicsFromKafka,
    isLoading: isLoadingTopics,
    error,
    fetchTopics,
  } = useFetchTopics({ kafka: kafkaStore })
  const analytics = useJourneyAnalytics()

  const {
    availableTopics,
    setAvailableTopics,
    topics: topicsFromStore,
    topicCount: topicCountFromStore,
    setTopicCount,
    updateTopic,
    invalidateTopicDependentState,
  } = topicsStore

  // Get existing topic data if available
  const storedTopic = topicsFromStore[index]
  const storedTopicName = storedTopic?.name
  const storedEvent = storedTopic?.selectedEvent?.event
  const initialOffset = storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST
  const [topicFetchAttempts, setTopicFetchAttempts] = useState(0)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isManualEventValid, setIsManualEventValid] = useState(false)
  const [manualEvent, setManualEvent] = useState('')
  const [localTopicName, setLocalTopicName] = useState(storedTopic?.name || '')
  const [localOffset, setLocalOffset] = useState<'earliest' | 'latest'>(
    (storedTopic?.initialOffset as 'latest' | 'earliest') || INITIAL_OFFSET_OPTIONS.LATEST,
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

  // Track page view when component loads - depending on the operation, we want to track the topic selection differently
  useEffect(() => {
    if (
      operationsSelected?.operation === OperationKeys.JOINING ||
      operationsSelected?.operation === OperationKeys.DEDUPLICATION_JOINING
    ) {
      if (index === 0) {
        analytics.page.selectLeftTopic({})
      } else {
        analytics.page.selectRightTopic({})
      }
    } else {
      analytics.page.selectTopic({})
    }
  }, [])

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

    // Update topic in the store
    updateTopic({
      index: index,
      name: topicName,
      initialOffset: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
      events: [
        {
          event,
          topicIndex: index,
          position: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
        },
      ],
      selectedEvent: {
        event,
        topicIndex: index,
        position: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
      },
      deduplication: storedTopic?.deduplication || {
        enabled: false,
        window: 0,
        unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
        key: '',
        keyType: '',
      },
    })

    setLocalTopicName(topicName)

    analytics.topic.selected({
      offset: storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
    })
  }

  // Handle offset change
  const handleOffsetChange = useCallback(
    (offset: 'earliest' | 'latest', event: any) => {
      // Update topic with new offset and event
      updateTopic({
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
        deduplication: storedTopic?.deduplication || {
          enabled: false,
          window: 0,
          unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
          key: '',
          keyType: '',
        },
      })

      setLocalOffset(offset)
    },
    [index, storedTopic, updateTopic],
  )

  // Handle form submission
  const handleSubmit = useCallback(() => {
    let event = null

    try {
      // if there's no event in the store, use the manual event
      event = (manualEvent ? JSON.parse(manualEvent) : null) || storedEvent
    } catch (e) {
      console.error('Error parsing event:', e)
      return
    }

    updateTopic({
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
      deduplication: storedTopic?.deduplication || {
        enabled: false,
        window: 0,
        unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
        key: '',
        keyType: '',
      },
    })

    setTopicCount(topicCountFromStore + 1)

    // Move to next step based on current step
    if (currentStep === StepKeys.TOPIC_SELECTION_1) {
      onCompleteStep(StepKeys.TOPIC_SELECTION_1)
    } else if (currentStep === StepKeys.TOPIC_SELECTION_2) {
      onCompleteStep(StepKeys.TOPIC_SELECTION_2)
    } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
      onCompleteStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
    } else if (currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
      onCompleteStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
    } else {
      // Fallback for any other topic selection step
      onCompleteStep(currentStep || StepKeys.TOPIC_SELECTION_1)
    }
  }, [
    index,
    onCompleteStep,
    setTopicCount,
    topicCountFromStore,
    manualEvent,
    localTopicName,
    localOffset,
    storedEvent,
    storedTopic?.deduplication,
    updateTopic,
    currentStep,
  ])

  return (
    <EventFetchProvider>
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
              isEditingEnabled={manualEvent !== '' || storedTopic?.selectedEvent?.isManualEvent || false}
            />
          </div>

          {/* Continue Button */}
          <div className="flex justify-between mt-6">
            <Button
              variant="gradient"
              className="btn-text btn-primary"
              onClick={handleSubmit}
              disabled={!(storedEvent || (manualEvent && isManualEventValid))}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </EventFetchProvider>
  )
}
