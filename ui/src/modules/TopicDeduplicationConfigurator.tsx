'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { useFetchTopics, useFetchEvent } from '../hooks/kafka-mng-hooks'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import {
  KafkaTopicSelectorSchema,
  KafkaTopicSelectorType,
  KafkaTopicSelectorWithEventType,
} from '@/src/scheme/topics.scheme'
import SelectDeduplicateKeys from '@/src/components/SelectDeduplicateKeys'
import { TopicSelectorForm } from '@/src/components/TopicSelectorForm'
import EventFetcher from '@/src/modules/event-fetcher/EventFetcher'

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
  const { operationsSelected, topicsStore, kafkaStore } = useStore()
  const {
    availableTopics,
    setAvailableTopics,
    topics: topicsFromStore,
    topicCount: topicCountFromStore,
    addTopic,
    updateTopic,
    getTopic,
    getEvent,
  } = topicsStore

  // Get existing topic data if available
  const existingTopic = getTopic(index)
  const existingEvent = getEvent(index, 0)

  // Combine the local states into a single object to reduce re-renders
  const [localState, setLocalState] = useState({
    topicName: existingTopic?.name || '',
    offset: (existingTopic?.initialOffset as 'latest' | 'earliest') || INITIAL_OFFSET_OPTIONS.LATEST,
    fetchedEvent: null,
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
    unit: existingTopic?.deduplication?.unit || 'seconds',
  })
  const [deduplicationConfigured, setDeduplicationConfigured] = useState(
    !!(existingTopic?.deduplication?.key && existingTopic?.deduplication?.window),
  )

  const formInitialized = useRef(false)

  // Check if we're returning to a previously filled form
  const isReturningToForm = existingTopic && existingTopic.name

  // Initialize form with React Hook Form
  const formMethods = useForm<KafkaTopicSelectorType>({
    resolver: zodResolver(KafkaTopicSelectorSchema),
    defaultValues: {
      topicName: existingTopic?.name || '',
      initialOffset: (existingTopic?.initialOffset as 'latest' | 'earliest') || INITIAL_OFFSET_OPTIONS.LATEST,
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

  // Fetch topics and events
  const { topics: topicsFromKafka, isLoading, error, fetchTopics } = useFetchTopics({ kafka: kafkaStore })

  const { fetchEvent, isLoadingEvent, eventError, event, hasMoreEvents, hasOlderEvents, resetEventState } =
    useFetchEvent(
      kafkaStore,
      'JSON', // FIXME: hardcoded for now - we need to get the data format from the topic
    )

  // Add a direct state for the event
  const [currentEvent, setCurrentEvent] = useState<any>(null)

  // Add a ref to track if we've received an event
  const eventReceivedRef = useRef(false)

  // Fetch topics on component mount
  useEffect(() => {
    if (availableTopics.length === 0 && !isLoading) {
      fetchTopics()
    }

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
  const handleTopicSelect = async (topic: string) => {
    if (topic === '') {
      return
    }

    // Reset event state when topic changes
    resetEventState()

    // Update form values
    setValue('topicName', topic)
    setLocalState((prev) => ({
      ...prev,
      topicName: topic,
    }))

    // Fetch event for the selected topic
    if (initialOffset) {
      fetchEvent(topic, false, {
        position: initialOffset,
      })
    }
  }

  // Handle form changes
  const handleFormChange = () => {
    setUserInteracted(true)
  }

  // Handle deduplication config changes
  const handleDeduplicationConfigChange = useCallback(
    (
      newKeyConfig: { key: string; keyType: string },
      newWindowConfig: { window: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' },
    ) => {
      setKeyConfig(newKeyConfig)
      setWindowConfig(newWindowConfig)

      // Update deduplication status
      setDeduplicationConfigured(!!(newKeyConfig.key && newWindowConfig.window))
    },
    [],
  )

  // Update the canContinue logic to include deduplication config
  const canContinue = topicName && isValid && (!isLoadingEvent || !!event) && deduplicationConfigured

  // Determine if we should show validation errors
  const shouldShowValidationErrors = userInteracted || !isInitialRender || isReturningToForm

  // Handle form submission
  const onSubmit = (data: KafkaTopicSelectorType) => {
    // Create deduplication config
    const deduplicationConfig = {
      enabled: true,
      index,
      window: windowConfig.window,
      unit: windowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      key: keyConfig.key,
      keyType: keyConfig.keyType,
    }

    // Get the actual event data
    const actualEventData = event?.event || currentEvent?.event || existingEvent?.event?.event

    // Get metadata from the event
    const kafkaOffset = event?.kafkaOffset || currentEvent?.kafkaOffset || 258 // Default to 258 if not available
    const isFromCache = event?.isFromCache || currentEvent?.isFromCache || false

    // Create the properly nested event structure
    const eventObject = {
      event: {
        event: actualEventData,
        position: data.initialOffset,
        kafkaOffset: kafkaOffset,
        isFromCache: isFromCache,
        topicIndex: index,
      },
      topicIndex: index,
      position: data.initialOffset,
    }

    // Update topic in the store
    updateTopic({
      name: data.topicName,
      initialOffset: data.initialOffset,
      events: [eventObject],
      selectedEvent: eventObject,
      deduplication: deduplicationConfig,
      index,
    })

    // Move to next step
    if (index === 0) {
      onNext(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
    } else {
      onNext(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
    }
  }

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
    },

    onEventError: (error: any) => {
      console.error('Event loading error:', error)
      setLocalState((prev) => ({
        ...prev,
        isLoading: false,
        fetchedEvent: null,
        canContinue: false,
      }))
    },
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full" onChange={handleFormChange}>
        <div className="flex flex-col gap-6 pb-6 bg-background-neutral-faded rounded-md p-0">
          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-row gap-6">
              {/* Form Fields - 40% width */}
              <div className="w-[40%] space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-weight-[400]">
                    This Kafka topic will be used as the data source for the pipeline.
                  </h3>
                </div>
                <TopicSelectorForm
                  errors={errors}
                  dynamicOptions={{ topicName: availableTopics.map((topic) => ({ label: topic, value: topic })) }}
                  onChange={(data) => handleTopicSelect(data.topicName)}
                />

                {/* Use the updated disabled condition */}
                {topicName && eventReceivedRef.current && (
                  <SelectDeduplicateKeys
                    index={index}
                    // @ts-expect-error - FIXME: fix this later
                    onChange={handleDeduplicationConfigChange}
                    disabled={!topicName || isLoadingEvent || (!event && !currentEvent && !eventReceivedRef.current)}
                    eventData={event || currentEvent || localState.fetchedEvent}
                  />
                )}
              </div>

              {/* EventPreview - 60% width */}
              <div className="w-[60%] min-h-[400px] h-full">
                <EventFetcher
                  topicName={topicName}
                  initialOffset={initialOffset}
                  topicIndex={index}
                  onEmptyTopic={() => {
                    // FIXME: check this
                    setLocalState((prev) => ({
                      ...prev,
                      canContinue: false,
                    }))
                  }}
                  {...eventHandlers}
                />
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-between mt-6">
            <Button variant="gradient" className="btn-text btn-primary" type="submit" disabled={!canContinue}>
              Continue
            </Button>

            {/* Optional: Add a debug indicator for deduplication status */}
            {topicName && event && !deduplicationConfigured && (
              <div className="text-amber-500 text-sm">Please configure deduplication settings to continue</div>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
