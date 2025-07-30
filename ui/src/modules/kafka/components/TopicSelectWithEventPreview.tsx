'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/src/utils/common.client'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { TopicOffsetSelect } from '@/src/modules/kafka/components/TopicOffsetSelect'
import EventManager from '@/src/components/shared/event-fetcher/EventManager'
import { useFetchEvent } from '@/src/hooks/useFetchKafkaEvents'
import { useStore } from '@/src/store'
import { EventDataFormat } from '@/src/config/constants'

export type TopicSelectWithEventPreviewProps = {
  index: number
  initialOffset?: 'earliest' | 'latest'
  availableTopics: string[]
  existingTopic?: {
    name?: string
    initialOffset?: 'earliest' | 'latest'
    selectedEvent?: any
  }
  onTopicChange?: (topicName: string, event: any) => void
  onOffsetChange?: (offset: 'earliest' | 'latest', event: any) => void
  onManualEventChange?: (event: string) => void
  additionalContent?: React.ReactNode
  isEditingEnabled: boolean
  readOnly?: boolean
}

export function TopicSelectWithEventPreview({
  index,
  existingTopic,
  onTopicChange,
  onOffsetChange,
  onManualEventChange,
  availableTopics,
  initialOffset = INITIAL_OFFSET_OPTIONS.LATEST as 'earliest' | 'latest',
  additionalContent,
  isEditingEnabled,
  readOnly,
}: TopicSelectWithEventPreviewProps) {
  const { kafkaStore } = useStore()

  // Local state for topic selection and event
  const [localState, setLocalState] = useState<{
    topicName: string
    offset: 'earliest' | 'latest'
    isLoading: boolean
    event: any
  }>({
    topicName: existingTopic?.name || '',
    offset: existingTopic?.initialOffset || initialOffset,
    isLoading: false,
    event: existingTopic?.selectedEvent?.event || null,
  })

  // Event fetching hook
  const { fetchEvent, isLoadingEvent, event, resetEventState } = useFetchEvent(kafkaStore, EventDataFormat.JSON)

  // Handle topic change
  const handleTopicChange = useCallback(
    async (topic: string) => {
      if (topic === '') return

      // If we already have an event for this topic in the store, use it
      if (existingTopic?.selectedEvent?.event && topic === existingTopic.name) {
        setLocalState((prev) => ({
          ...prev,
          topicName: topic,
          event: existingTopic.selectedEvent.event,
          isLoading: false,
        }))
        return
      }

      // Always set loading state when changing topic
      setLocalState((prev) => ({
        ...prev,
        topicName: topic,
        isLoading: true,
        event: null,
      }))

      // Reset event state when topic changes
      resetEventState()

      // Fetch event for the selected topic
      if (localState.offset) {
        fetchEvent(topic, false, {
          position: localState.offset,
        })
      }

      // Then notify parent of changes
      if (onTopicChange && topic) {
        onTopicChange(topic, null)
      }
    },
    [localState.offset, fetchEvent, resetEventState, existingTopic, onTopicChange],
  )

  // Handle offset change
  const handleOffsetChange = useCallback(
    (offset: 'earliest' | 'latest') => {
      // If we're changing offset for the same topic and we already have an event, use it
      if (localState.topicName === existingTopic?.name && existingTopic?.selectedEvent?.event) {
        setLocalState((prev) => ({
          ...prev,
          offset,
          event: existingTopic.selectedEvent.event,
        }))
        return
      }

      // Always set loading state when changing offset
      setLocalState((prev) => ({
        ...prev,
        offset,
        isLoading: true,
        event: null,
      }))

      // Reset event state when offset changes
      resetEventState()

      // Fetch event with new offset
      if (localState.topicName) {
        fetchEvent(localState.topicName, false, {
          position: offset,
        })
      }
    },
    [localState.topicName, fetchEvent, existingTopic, resetEventState],
  )

  // Event handlers
  const eventHandlers = {
    onEventLoading: () => {
      setLocalState((prev) => ({ ...prev, isLoading: true }))
    },

    onEventLoaded: (eventData: any) => {
      // Ensure we have a properly formatted event
      const formattedEvent = eventData?.event ? eventData : { event: eventData }

      // Update local state first
      setLocalState((prev) => ({
        ...prev,
        event: formattedEvent,
        isLoading: false,
      }))

      // Then notify parent of changes
      if (onTopicChange && localState.topicName) {
        onTopicChange(localState.topicName, formattedEvent.event)
      }
    },

    onEventError: (error: any) => {
      console.error('Event loading error:', error)
      setLocalState((prev) => ({
        ...prev,
        isLoading: false,
        event: null,
      }))
    },

    onEmptyTopic: () => {
      setLocalState((prev) => ({
        ...prev,
        isLoading: false,
        event: null,
      }))
    },
  }

  // Initialize with existing event if available
  useEffect(() => {
    if (existingTopic?.selectedEvent?.event && !localState.event) {
      setLocalState((prev) => ({
        ...prev,
        event: existingTopic.selectedEvent.event,
      }))
    }
  }, [existingTopic?.selectedEvent?.event])

  return (
    <div className="flex flex-row gap-6">
      {/* Form Fields */}
      <div
        className={cn(
          'w-[40%] space-y-4',
          localState.isLoading && 'opacity-50 pointer-events-none transition-opacity duration-200',
        )}
      >
        <h3 className="text-md font-medium step-description">
          This Kafka topic will be used as the data source of your pipeline.
        </h3>
        <div className="flex flex-col gap-4 pt-8">
          <TopicOffsetSelect
            index={index}
            topicValue={localState.topicName}
            isLoadingEvent={localState.isLoading}
            offsetValue={localState.offset}
            onTopicChange={handleTopicChange}
            onOffsetChange={handleOffsetChange}
            onBlur={() => {}}
            onOpenChange={() => {}}
            topicError={''}
            offsetError={''}
            topicPlaceholder="Select a topic"
            offsetPlaceholder="Select initial offset"
            topicOptions={availableTopics.map((topic) => ({ label: topic, value: topic }))}
            offsetOptions={Object.entries(INITIAL_OFFSET_OPTIONS).map(([key, value]) => ({
              label: value,
              value: value as 'earliest' | 'latest',
            }))}
            readOnly={readOnly}
          />
          {localState.isLoading && (
            <div className="flex items-center gap-2 text-sm text-content">
              <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
              <span>Fetching the event schema...</span>
            </div>
          )}

          {/* Additional content slot */}
          {additionalContent}
        </div>
      </div>

      {/* Event Preview */}
      <div className="w-[60%] min-h-[450px] h-full">
        <EventManager
          topicName={localState.topicName}
          initialOffset={localState.offset}
          topicIndex={index}
          initialEvent={localState.event?.event || existingTopic?.selectedEvent?.event}
          isEditingEnabled={isEditingEnabled}
          onEventLoading={eventHandlers.onEventLoading}
          onEventLoaded={eventHandlers.onEventLoaded}
          onEventError={eventHandlers.onEventError}
          onEmptyTopic={eventHandlers.onEmptyTopic}
          onManualEventChange={onManualEventChange}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
