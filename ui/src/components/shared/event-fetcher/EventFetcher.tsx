'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { EventEditor } from '../EventEditor'
import { parseForCodeEditor } from '@/src/utils/common.client'
import { KafkaEventType } from '@/src/scheme/topics.scheme'
import { useFetchEventWithCaching } from '../../../modules/kafka/useFetchEventWithCaching'
import { EventFetcherProps } from './types'
import { cn } from '@/src/utils/common.client'

function EventFetcher({
  topicName,
  topicIndex,
  initialOffset,
  initialEvent,
  onEventLoading,
  onEventLoaded,
  onEventError,
  onEmptyTopic,
  onManualEventChange,
  isEditingEnabled,
  readOnly,
}: EventFetcherProps) {
  const { kafkaStore } = useStore()

  // Local state for current event
  const [currentEvent, setCurrentEvent] = useState<any>(() => {
    if (initialEvent) {
      return {
        event: initialEvent,
        position: initialOffset,
        kafkaOffset: 0,
        isAtEarliest: false,
        isAtLatest: false,
        topicIndex: topicIndex,
      }
    }
    return null
  })
  const [currentTopic, setCurrentTopic] = useState<string>(topicName)
  const [isEmptyTopic, setIsEmptyTopic] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Use the custom hook
  const {
    state,
    handleFetchNewestEvent,
    handleFetchOldestEvent,
    handleFetchNextEvent,
    handleFetchPreviousEvent,
    handleRefreshEvent,
  } = useFetchEventWithCaching(
    kafkaStore,
    'JSON',
    () => {
      setIsLoading(true)
      onEventLoading()
    },
    onEventError,
    (offset) => {
      if (offset !== null) {
        setCurrentEvent((prev: any) => ({
          ...prev,
          kafkaOffset: offset,
        }))
      }
    },
  )

  // Initial fetch when component mounts or topic changes or initialOffset changes
  useEffect(() => {
    // Only fetch if:
    // 1. We have a topic and offset AND
    // 2. Either:
    //    a. We don't have an initial event OR
    //    b. The topic has changed OR
    //    c. The offset has changed
    const shouldFetch =
      topicName &&
      initialOffset &&
      (!initialEvent || topicName !== currentTopic || initialOffset !== currentEvent?.position)

    if (shouldFetch) {
      // Reset state for new fetch
      setCurrentEvent(null)
      setCurrentTopic(topicName)
      setIsEmptyTopic(false)
      setIsLoading(true)

      // If we have an initial event and the topic hasn't changed, use it
      if (initialEvent && topicName === currentTopic && initialOffset === currentEvent?.position) {
        const kafkaEvent: KafkaEventType = {
          event: initialEvent,
          position: initialOffset,
          kafkaOffset: 0,
          isAtEarliest: false,
          isAtLatest: false,
          topicIndex: topicIndex,
        }
        setCurrentEvent(kafkaEvent)
        setIsLoading(false)
        onEventLoaded(kafkaEvent)
        return
      }

      // Determine which fetch method to use based on initialOffset
      if (initialOffset === 'latest') {
        handleFetchNewestEvent(topicName)
      } else if (initialOffset === 'earliest') {
        handleFetchOldestEvent(topicName)
      } else if (!isNaN(Number(initialOffset))) {
        handleRefreshEvent(topicName)
      } else {
        handleFetchNewestEvent(topicName)
      }
    }
  }, [topicName, initialOffset, initialEvent, currentTopic, currentEvent?.position])

  // Update currentEvent when state changes
  useEffect(() => {
    if (state.isEmptyTopic) {
      setCurrentEvent(null)
      setCurrentTopic(topicName)
      setIsEmptyTopic(true)
      setIsLoading(false)
      onEmptyTopic()
      return
    }

    if (state.event) {
      const kafkaEvent: KafkaEventType = {
        event: state.event,
        position: initialOffset,
        kafkaOffset: state.currentOffset || 0,
        isAtEarliest: state.isAtEarliest,
        isAtLatest: state.isAtLatest,
        topicIndex: topicIndex,
      }

      setCurrentEvent(kafkaEvent)
      setCurrentTopic(topicName)
      setIsEmptyTopic(false)
      setIsLoading(false)
      onEventLoaded(kafkaEvent)
    }

    if (state.error) {
      if (state.error.includes('No events found') || state.error.includes('End of topic reached')) {
        setIsEmptyTopic(true)
        setCurrentEvent(null)
        setIsLoading(false)
        onEmptyTopic()
      } else {
        setIsLoading(false)
        onEventError(state.error)
      }
    }
  }, [state])

  // Button action handlers
  const handleFetchNext = () => {
    if (currentEvent && !state.isLoading) {
      handleFetchNextEvent(topicName, currentEvent.kafkaOffset)
    }
  }

  const handleFetchPrevious = () => {
    if (currentEvent && !state.isLoading) {
      handleFetchPreviousEvent(topicName, currentEvent.kafkaOffset)
    }
  }

  const handleFetchOldest = () => {
    if (topicName && !state.isLoading) {
      handleFetchOldestEvent(topicName)
    }
  }

  const handleFetchNewest = () => {
    if (topicName && !state.isLoading) {
      handleFetchNewestEvent(topicName)
    }
  }

  const handleRefresh = () => {
    if (topicName && !state.isLoading) {
      handleFetchNewestEvent(topicName)
    }
  }

  const eventError =
    state.error || (isEmptyTopic ? 'This topic has no events. Please enter the event schema manually.' : '')

  return (
    <div className="flex flex-col h-full w-full min-h-[400px] overflow-auto">
      {(currentEvent?.event || isEmptyTopic || isLoading) && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3
              className={cn(
                'text-md font-medium step-description',
                isLoading && 'opacity-50 pointer-events-none transition-opacity duration-200',
              )}
            >
              Sample event
            </h3>
          </div>

          <EventEditor
            event={parseForCodeEditor(currentEvent?.event)}
            topic={topicName}
            isLoadingEvent={isLoading || (state.isLoading && !isEmptyTopic)}
            eventError={eventError}
            isEmptyTopic={isEmptyTopic}
            onManualEventChange={onManualEventChange}
            isEditingEnabled={isEditingEnabled}
            readOnly={readOnly}
          />

          {/* Navigation buttons are hidden to simplify the UI */}
          {/*
          {currentEvent?.event && !isEmptyTopic && (
            <div className="flex flex-row gap-2 mt-4">
              <Button
                onClick={handleFetchPrevious}
                variant="gradient"
                className="btn-text btn-neutral"
                type="button"
                disabled={state.isAtEarliest || !topicName}
              >
                Previous Event
              </Button>
              <Button
                onClick={handleFetchNext}
                variant="gradient"
                className="btn-text btn-neutral"
                type="button"
                disabled={state.isAtLatest || !topicName}
              >
                Next Event
              </Button>
            </div>
          )}
          */}
        </>
      )}
    </div>
  )
}
export default EventFetcher
