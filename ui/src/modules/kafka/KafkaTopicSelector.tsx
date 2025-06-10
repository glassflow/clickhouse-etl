'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { TIME_WINDOW_UNIT_OPTIONS, OperationKeys } from '@/src/config/constants'
import { StepKeys } from '@/src/config/constants'
import { useFetchTopics } from '../../hooks/kafka-mng-hooks'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { useEventFetchContext } from '../../components/shared/event-fetcher/EventFetchContext'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { TopicSelectWithEventPreview } from '@/src/modules/kafka/components/TopicSelectWithEventPreview'

export type TopicSelectorProps = {
  steps: any
  onNext: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  index: number
}

export function KafkaTopicSelector({ steps, onNext, validate, index }: TopicSelectorProps) {
  const { topicsStore, kafkaStore, joinStore, operationsSelected } = useStore()
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

  // Get access to the event fetching state from the context
  const { state } = useEventFetchContext()

  // Get access to the steps store functions
  const { removeCompletedStepsAfter } = useStore()

  // Get existing topic data if available
  const topicFromStore = topicsFromStore[index]
  const storedEvent = topicFromStore?.selectedEvent?.event

  // Check if we're returning to a previously filled form
  const isReturningToForm = topicFromStore && topicFromStore.name

  // Hook to fetch topics
  const {
    topics: topicsFromKafka,
    isLoading: isLoadingTopics,
    error,
    fetchTopics,
  } = useFetchTopics({ kafka: kafkaStore })

  // Track if this is the initial render or a return visit
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [showEventPreview, setShowEventPreview] = useState(false)
  const [showOffsetField, setShowOffsetField] = useState(false)
  const [isEmptyTopic, setIsEmptyTopic] = useState(false)
  const [isManualEventValid, setIsManualEventValid] = useState(false)

  // just a replication of the topic name and offset from the store
  const [topicName, setTopicName] = useState(topicsFromStore[index]?.name || '')
  const [initialOffset, setInitialOffset] = useState<'earliest' | 'latest'>(
    topicsFromStore[index]?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
  )

  // Combine the local states into a single object to reduce re-renders
  const [localState, setLocalState] = useState<{
    topicName: string
    offset: 'earliest' | 'latest'
    isLoading: boolean
    userInteracted: boolean
    fetchedEvent: any
    manualEvent: string
    isManualEventValid: boolean
  }>({
    topicName: topicFromStore?.name || '',
    offset: (topicFromStore?.initialOffset as 'latest' | 'earliest') || INITIAL_OFFSET_OPTIONS.LATEST,
    isLoading: false,
    userInteracted: false,
    fetchedEvent: storedEvent || null,
    manualEvent: topicFromStore?.selectedEvent?.event
      ? JSON.stringify(topicFromStore?.selectedEvent?.event, null, 2)
      : '',
    isManualEventValid: false,
  })

  // Handle empty topic state
  const handleEmptyTopic = useCallback(() => {
    setIsEmptyTopic(true)
    setShowEventPreview(true)
    setShowOffsetField(true)
    setLocalState((prev) => ({
      ...prev,
      isLoading: false,
    }))

    analytics.topic.noEvent({})
  }, [index])

  // Handle manual event input
  const handleManualEventChange = (event: string) => {
    setLocalState((prev) => ({
      ...prev,
      manualEvent: event,
      isManualEventValid: false,
    }))
  }

  // ================================ EFFECTS ================================

  const [topicFetchAttempts, setTopicFetchAttempts] = useState(0)

  useEffect(() => {
    if (localState.manualEvent) {
      try {
        JSON.parse(localState.manualEvent)
        setLocalState((prev) => ({
          ...prev,
          isManualEventValid: true,
        }))
      } catch (error) {
        setLocalState((prev) => ({
          ...prev,
          isManualEventValid: false,
        }))
      }
    } else {
      setLocalState((prev) => ({
        ...prev,
        isManualEventValid: false,
      }))
    }
  }, [localState.manualEvent])

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
    if (topicName && !isInitialRender) {
      // Skip if we're just setting the initial value or there's no actual change
      if (topicName === '' || topicName === localState.topicName) return

      // Clear join store whenever topic name changes
      joinStore.setEnabled(false)
      joinStore.setType('')
      joinStore.setStreams([])

      setLocalState((prev) => ({
        ...prev,
        topicName: topicName,
        userInteracted: true,
      }))

      setShowEventPreview(true)
    }
  }, [topicName, index, availableTopics.length, topicFromStore?.name, localState.topicName, isInitialRender, joinStore])

  // Update local state when offset changes
  useEffect(() => {
    if (initialOffset && !isInitialRender) {
      // Skip if there's no actual change to avoid loops
      if (initialOffset === localState.offset) return

      // Skip event fetching if we know the topic is empty
      if (isEmptyTopic) {
        setLocalState((prev) => ({
          ...prev,
          offset: initialOffset,
          userInteracted: true,
        }))
        return
      }

      // Just use the handler function instead of duplicating state updates
      setLocalState((prev) => ({
        ...prev,
        offset: initialOffset,
        userInteracted: true,
        // Keep existing event if we have it
      }))
    }
  }, [initialOffset, isEmptyTopic, isInitialRender, localState.offset])

  // Update local state when event is loaded - user can continue to next step
  useEffect(() => {
    // If we have an event in the store, show the offset field
    if (storedEvent) {
      setShowOffsetField(true)
    }
  }, [storedEvent])

  // ================================ HANDLERS ================================

  // Handle topic change
  const handleTopicChange = (topicName: string, event: any) => {
    // If the topic name changed, invalidate dependent state
    if (topicName !== topicFromStore?.name) {
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
      initialOffset: topicFromStore?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
      events: [
        {
          event,
          topicIndex: index,
          position: topicFromStore?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
        },
      ],
      selectedEvent: {
        event,
        topicIndex: index,
        position: topicFromStore?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
      },
      deduplication: topicFromStore?.deduplication || {
        enabled: false,
        window: 0,
        unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
        key: '',
        keyType: '',
      },
    })

    setLocalState((prev) => ({
      ...prev,
      topicName,
      fetchedEvent: event,
      userInteracted: true,
    }))

    analytics.topic.selected({
      offset: topicFromStore?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST,
    })
  }

  // Handle offset change
  const handleOffsetChange = useCallback(
    (offset: 'earliest' | 'latest', event: any) => {
      // Update topic with new offset and event
      updateTopic({
        index: index,
        name: topicFromStore?.name || '',
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
        deduplication: topicFromStore?.deduplication || {
          enabled: false,
          window: 0,
          unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
          key: '',
          keyType: '',
        },
      })

      setLocalState((prev) => ({
        ...prev,
        offset,
        fetchedEvent: event,
      }))
    },
    [index, topicFromStore, updateTopic],
  )

  // Handle form submission
  const handleSubmit = useCallback(() => {
    let event = null

    try {
      // if there's no event in the store, use the manual event
      event = storedEvent || (localState.manualEvent ? JSON.parse(localState.manualEvent) : null)
    } catch (e) {
      console.error('Error parsing event:', e)
      return
    }

    // this is how it previously worked but it's causing flickering of the event editor
    // Update the store directly instead of local state
    updateTopic({
      index: index,
      name: localState.topicName,
      initialOffset,
      events: [{ event: event, topicIndex: index, position: initialOffset }],
      selectedEvent: { event: event, topicIndex: index, position: initialOffset },
      deduplication: topicFromStore?.deduplication || {
        enabled: false,
        window: 0,
        unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
        key: '',
        keyType: '',
      },
    })

    setTopicCount(topicCountFromStore + 1)

    // Move to next step
    if (index === 0) {
      onNext(StepKeys.TOPIC_SELECTION_1)
    } else {
      onNext(StepKeys.TOPIC_SELECTION_2)
    }
  }, [
    index,
    onNext,
    setTopicCount,
    topicCountFromStore,
    localState.manualEvent,
    localState.topicName,
    storedEvent,
    initialOffset,
    topicFromStore?.deduplication,
    updateTopic,
  ])

  // Determine if we should show validation errors
  const shouldShowValidationErrors = localState.userInteracted || !isInitialRender || isReturningToForm

  // Event handlers for EventFetcher
  const fetchEventHandlers = {
    onEventLoading: useCallback(() => {
      setLocalState((prev) => ({ ...prev, isLoading: true }))
    }, []),

    onEventLoaded: useCallback(
      (event: any) => {
        // Clear join store whenever a new event is loaded
        joinStore.setEnabled(false)
        joinStore.setType('')
        joinStore.setStreams([])

        // Update local state
        setLocalState((prev) => ({
          ...prev,
          fetchedEvent: event,
          isLoading: false,
          userInteracted: true,
          canContinue: !!event && !!prev.topicName && !!prev.offset,
        }))
        setShowOffsetField(true)

        // IMPORTANT: Also update the topic in the store immediately when an event is loaded
        // This fixes the issue where the event isn't updated in the store until form submission
        if (event && topicName) {
          const newEvent = { event, topicIndex: index, position: initialOffset }

          updateTopic({
            index: index,
            name: topicName,
            initialOffset,
            events: [newEvent],
            selectedEvent: newEvent,
            deduplication: topicFromStore?.deduplication || {
              enabled: false,
              window: 0,
              unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value as 'seconds' | 'minutes' | 'hours' | 'days',
              key: '',
              keyType: '',
            },
          })
        }

        // Track successful event retrieval
        if (event) {
          analytics.topic.eventReceived({
            topicName: topicName,
            topicIndex: index,
            eventSize: JSON.stringify(event).length,
            isManual: false,
          })
        }
      },
      [index, topicName, initialOffset, analytics.topic, joinStore, updateTopic, topicFromStore?.deduplication],
    ),

    onEventError: useCallback(
      (error: any) => {
        console.error('onEventError called with error:', error)
        setLocalState((prev) => ({
          ...prev,
          isLoading: false,
          fetchedEvent: null,
          canContinue: false,
        }))

        // Track error in event fetching
        analytics.topic.eventError({
          topicName: topicName,
          error: error instanceof Error ? error.message : 'Failed to fetch event',
        })
      },
      [topicName, analytics.topic],
    ),
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-6 pb-6 bg-background-neutral-faded rounded-md p-0">
        <div className="grid grid-cols-1 gap-6">
          <TopicSelectWithEventPreview
            index={index}
            existingTopic={topicFromStore}
            onTopicChange={handleTopicChange}
            onOffsetChange={handleOffsetChange}
            onManualEventChange={handleManualEventChange}
            availableTopics={availableTopics}
          />
        </div>

        {/* Continue Button */}
        <div className="flex justify-between mt-6">
          <Button
            variant="gradient"
            className="btn-text btn-primary"
            onClick={handleSubmit}
            disabled={!(storedEvent || (localState.manualEvent && localState.isManualEventValid))}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
