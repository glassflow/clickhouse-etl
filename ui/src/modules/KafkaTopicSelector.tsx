'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { useAnalytics } from '@/src/hooks/useAnalytics'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'
import { StepKeys } from '@/src/config/constants'
import { useFetchTopics, useFetchEvent } from '../hooks/kafka-mng-hooks'
import { EventPreview } from '../components/wizard/EventPreview'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { TopicSelectorFormConfig } from '@/src/config/topic-selector-form-config'
import { parseForCodeEditor } from '@/src/utils'
import { useRenderFormFields, FormGroup } from '@/src/components/ui/form'
import { FieldErrors, useFormContext } from 'react-hook-form'
import {
  KafkaTopicSelectorSchema,
  KafkaTopicSelectorType,
  KafkaTopicSelectorWithEventType,
} from '@/src/scheme/topics.scheme'
import EventFetcher from './event-fetcher/EventFetcher'
import classnames from 'classnames'
import { TopicSelectorForm } from '@/src/components/TopicSelectorForm'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'

// Add a utility function for debouncing
const debounce = (fn: (...args: any[]) => void, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>
  return function (...args: any[]) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), ms)
  }
}

export type TopicSelectorProps = {
  steps: any
  onNext: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  index: number
}

export function KafkaTopicSelector({ steps, onNext, validate, index }: TopicSelectorProps) {
  const { operationsSelected, topicsStore, kafkaStore } = useStore()
  const { trackFunnelStep, trackError } = useAnalytics()
  const {
    availableTopics,
    setAvailableTopics,
    topics: topicsFromStore,
    topicCount: topicCountFromStore,
    setTopicCount,
    addTopic,
    updateTopic,
    getTopic,
    getEvent,
  } = topicsStore

  // Track if this is the initial render or a return visit
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)
  const formInitialized = useRef(false)
  const [showEventPreview, setShowEventPreview] = useState(false)
  const [showOffsetField, setShowOffsetField] = useState(false)
  const [isEmptyTopic, setIsEmptyTopic] = useState(false)
  const [manualEvent, setManualEvent] = useState('')
  const [hasTrackedTopicSelection, setHasTrackedTopicSelection] = useState(false)

  // Track last tracked topic to prevent duplicate tracking
  const lastTrackedTopic = useRef<string | null>(null)
  // Create debounced versions of tracking functions to prevent excessive calls
  const debouncedTrackFunnelStep = useCallback(
    debounce((step: string, props?: Record<string, unknown>) => {
      trackFunnelStep(step, props)
    }, 500),
    [trackFunnelStep],
  )

  // Get existing topic data if available
  const topicFromStore = getTopic(index)
  const storedEvent = topicFromStore?.selectedEvent?.event

  // Check if we're returning to a previously filled form
  const isReturningToForm = topicFromStore && topicFromStore.name

  // Initialize form with React Hook Form
  const formMethods = useForm<KafkaTopicSelectorType>({
    resolver: zodResolver(KafkaTopicSelectorSchema),
    defaultValues: {
      topicName: topicFromStore?.name || '',
      initialOffset: (topicFromStore?.initialOffset as 'latest' | 'earliest') || INITIAL_OFFSET_OPTIONS.LATEST,
    },
    mode: 'onChange',
  })

  const {
    watch,
    setValue,
    handleSubmit,
    register,
    trigger,
    formState: { errors, isValid, isDirty, touchedFields },
  } = formMethods

  // Watch for changes to form values
  const topicName = watch('topicName')
  const initialOffset = watch('initialOffset')

  // Use stored event when returning to a completed step
  useEffect(() => {
    if (isReturningToForm && storedEvent && !lastTrackedTopic.current) {
      setLocalState((prev) => ({
        ...prev,
        fetchedEvent: storedEvent,
        isLoading: false,
        userInteracted: true,
        canContinue: true,
      }))
      setShowOffsetField(true)
      setShowEventPreview(true)

      // Track topic retrieval for returning users (only if analytics is enabled)
      if (topicFromStore?.name && topicFromStore.name !== lastTrackedTopic.current) {
        lastTrackedTopic.current = topicFromStore.name
        debouncedTrackFunnelStep('topicSelected', {
          topicName: topicFromStore?.name,
          topicIndex: index,
          isReturningVisit: true,
        })
      }
    }
  }, [isReturningToForm, storedEvent, debouncedTrackFunnelStep, index, topicFromStore?.name])

  // Fetch topics and events
  const {
    topics: topicsFromKafka,
    isLoading: isLoadingTopics,
    error,
    fetchTopics,
  } = useFetchTopics({ kafka: kafkaStore })

  // Combine the local states into a single object to reduce re-renders
  const [localState, setLocalState] = useState<{
    topicName: string
    offset: 'earliest' | 'latest'
    fetchedEvent: { event: any } | null
    isLoading: boolean
    userInteracted: boolean
    canContinue: boolean
  }>({
    topicName: topicFromStore?.name || '',
    offset: (topicFromStore?.initialOffset as 'latest' | 'earliest') || INITIAL_OFFSET_OPTIONS.LATEST,
    fetchedEvent: null,
    isLoading: false,
    userInteracted: false,
    canContinue: false,
  })

  // Handle empty topic state
  const handleEmptyTopic = useCallback(() => {
    setIsEmptyTopic(true)
    setShowEventPreview(true)
    setShowOffsetField(true)
    setLocalState((prev) => ({
      ...prev,
      isLoading: false,
      fetchedEvent: null,
      canContinue: false, // Reset canContinue until user provides manual schema
    }))

    // Track empty topic event (only if it's not already tracked)
    if (localState.topicName && localState.topicName !== lastTrackedTopic.current) {
      lastTrackedTopic.current = localState.topicName
      debouncedTrackFunnelStep('topicSelected', {
        topicName: localState.topicName,
        topicIndex: index,
        isEmpty: true,
      })
    }
  }, [localState.topicName, index, debouncedTrackFunnelStep])

  // Handle manual event input
  const handleManualEventChange = useCallback(
    (event: string) => {
      try {
        // Validate JSON
        const parsedEvent = JSON.parse(event)
        setLocalState((prev) => ({
          ...prev,
          fetchedEvent: { event: parsedEvent },
          canContinue: true,
        }))

        // Track manual event creation (debounced to prevent excessive calls)
        debouncedTrackFunnelStep('eventReceived', {
          topicName: localState.topicName,
          topicIndex: index,
          eventSize: event.length,
          isManual: true,
        })
      } catch (e) {
        setLocalState((prev) => ({
          ...prev,
          canContinue: false,
        }))

        // Track error in manual event (using debounce)
        setTimeout(() => {
          trackError('validation', {
            component: 'ManualEventInput',
            topicName: localState.topicName,
            error: e instanceof Error ? e.message : 'Invalid JSON',
          })
        }, 500)
      }
    },
    [localState.topicName, index, debouncedTrackFunnelStep, trackError],
  )

  // ================================ EFFECTS ================================

  // Fetch topics on component mount
  useEffect(() => {
    if (availableTopics.length === 0 && !isLoadingTopics) {
      fetchTopics()
    }

    // Mark that we're no longer on initial render after the first effect run
    if (isInitialRender) {
      setIsInitialRender(false)
    }
  }, [availableTopics.length, fetchTopics, isLoadingTopics, isInitialRender])

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

      setLocalState((prev) => ({
        ...prev,
        topicName: topicName,
        userInteracted: true,
      }))
      setShowEventPreview(true)

      // Track topic selection if this is the first time (with proper guards)
      if (!hasTrackedTopicSelection && topicName !== topicFromStore?.name && topicName !== lastTrackedTopic.current) {
        lastTrackedTopic.current = topicName
        debouncedTrackFunnelStep('topicSelected', {
          topicName: topicName,
          topicIndex: index,
          totalAvailableTopics: availableTopics.length,
        })
        setHasTrackedTopicSelection(true)
      }
    }
  }, [
    topicName,
    hasTrackedTopicSelection,
    debouncedTrackFunnelStep,
    index,
    availableTopics.length,
    topicFromStore?.name,
    localState.topicName,
    isInitialRender,
  ])

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
    // Avoid unnecessary updates if nothing has changed
    const shouldUpdateState =
      localState.fetchedEvent && localState.topicName && localState.offset && !localState.canContinue

    if (shouldUpdateState) {
      setLocalState((prev) => ({
        ...prev,
        canContinue: true,
      }))
      setShowOffsetField(true)
    }
  }, [localState.fetchedEvent, localState.topicName, localState.offset, localState.canContinue])

  // ================================ HANDLERS ================================

  // Form field change handler
  const handleFormChange = useCallback(() => {
    setLocalState((prev) => ({
      ...prev,
      userInteracted: true,
    }))
  }, [])

  // Handle form submission
  const onSubmit = (data: KafkaTopicSelectorType) => {
    // Create the combined data with event
    const submissionData: KafkaTopicSelectorWithEventType = {
      ...data,
      event: {
        event: localState.fetchedEvent,
        topicIndex: index,
        position: localState.offset,
      },
    }

    // Track the deduplication key step completion
    trackFunnelStep('eventReceived', {
      topicName: data.topicName,
      topicIndex: index,
      eventSize: JSON.stringify(localState.fetchedEvent).length,
      offset: data.initialOffset,
    })

    // Update topic in the store
    updateTopic({
      index: index,
      name: data.topicName,
      initialOffset: data.initialOffset,
      events: [
        ...(topicFromStore?.events || []),
        { event: localState.fetchedEvent, topicIndex: index, position: localState.offset },
      ],
      selectedEvent: { event: localState.fetchedEvent, topicIndex: index, position: localState.offset },
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
  }

  // Determine if we should show validation errors
  const shouldShowValidationErrors = localState.userInteracted || !isInitialRender || isReturningToForm

  // Simplify the event handlers
  const fetchEventHandlers = {
    onEventLoading: useCallback(() => {
      setLocalState((prev) => ({ ...prev, isLoading: true }))
    }, []),

    onEventLoaded: useCallback(
      (event: any) => {
        setLocalState((prev) => ({
          ...prev,
          fetchedEvent: event,
          isLoading: false,
          userInteracted: true,
          canContinue: !!event && !!prev.topicName && !!prev.offset,
        }))
        setShowOffsetField(true)

        // Track successful event retrieval
        if (event) {
          trackFunnelStep('eventReceived', {
            topicName: localState.topicName,
            topicIndex: index,
            eventSize: JSON.stringify(event).length,
            isManual: false,
          })
        }
      },
      [index, localState.topicName, trackFunnelStep],
    ),

    onEventError: useCallback(
      (error: any) => {
        console.error('Event fetch error:', error)
        setLocalState((prev) => ({
          ...prev,
          isLoading: false,
          fetchedEvent: null,
          canContinue: false,
        }))

        // Track error in event fetching
        trackError('connection', {
          component: 'EventFetcher',
          topicName: localState.topicName,
          error: error instanceof Error ? error.message : 'Failed to fetch event',
        })
      },
      [localState.topicName, trackError],
    ),
  }

  const handleTopicChange = ({ topicName, offset }: { topicName: string; offset: string }) => {
    // Skip the update if nothing has actually changed to prevent loops
    if (topicName === localState.topicName && offset === localState.offset) {
      return
    }

    // @ts-expect-error - FIXME: fix this later
    setLocalState((prev) => ({
      ...prev,
      topicName,
      isLoading: true,
      fetchedEvent: null,
      canContinue: false,
      offset,
    }))
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full" onChange={handleFormChange}>
        <div className="flex flex-col gap-6 pb-6 bg-background-neutral-faded rounded-md p-0">
          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-row gap-6">
              {/* Form Fields */}
              <div
                className={classnames(
                  'w-[40%] space-y-4',
                  localState.isLoading && 'opacity-50 pointer-events-none transition-opacity duration-200',
                )}
              >
                <h3 className="text-md font-medium step-description">
                  This Kafka topic will be used as the data source of your pipeline.
                </h3>
                <div className="flex flex-col gap-4 pt-8">
                  <TopicSelectorForm
                    errors={shouldShowValidationErrors ? errors : {}}
                    dynamicOptions={{
                      topicName: availableTopics.map((topic) => ({
                        label: topic,
                        value: topic,
                      })),
                    }}
                    onChange={handleTopicChange}
                    hiddenFields={showOffsetField ? [] : ['initialOffset']}
                  />
                  {localState.isLoading && !isEmptyTopic && (
                    <div className="flex items-center gap-2 text-sm text-content">
                      <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
                      <span>Fetching the event schema...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Preview */}
              <div className="w-[60%] min-h-[450px] h-full">
                {showEventPreview && (
                  <EventFetcher
                    topicName={localState.topicName}
                    initialOffset={localState.offset}
                    topicIndex={index}
                    initialEvent={localState.fetchedEvent}
                    onEventLoading={fetchEventHandlers.onEventLoading}
                    onEventLoaded={fetchEventHandlers.onEventLoaded}
                    onEventError={fetchEventHandlers.onEventError}
                    onEmptyTopic={handleEmptyTopic}
                    onEventChange={handleManualEventChange}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-between mt-6">
            <Button
              variant="gradient"
              className="btn-text btn-primary"
              type="submit"
              disabled={!localState.canContinue}
            >
              Continue
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
