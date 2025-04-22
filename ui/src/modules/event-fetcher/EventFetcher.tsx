'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { EventPreview } from '../../components/wizard/EventPreview'
import { Button } from '../../components/ui/button'
import { parseForCodeEditor } from '@/src/utils/'
import { KafkaEventType } from '@/src/scheme/topics.scheme'
import { useFetchEventWithCaching } from './useFetchEventWithCaching'

type EventFetcherProps = {
  topicName: string
  topicIndex: number
  initialOffset: string
  initialEvent?: any
  onEventLoading: () => void
  onEventLoaded: (event: any) => void
  onEventError: (error: any) => void
  onEmptyTopic: () => void
  onEventChange?: (event: string) => void
}

function EventFetcher({
  topicName,
  topicIndex,
  initialOffset,
  initialEvent,
  onEventLoading,
  onEventLoaded,
  onEventError,
  onEmptyTopic,
  onEventChange,
}: EventFetcherProps) {
  const { kafkaStore } = useStore()

  // Local state for current event
  const [currentEvent, setCurrentEvent] = useState<any>(initialEvent || null)
  const [currentTopic, setCurrentTopic] = useState<string>(topicName)
  const [kafkaOffset, setKafkaOffset] = useState<number | null>(null)
  const [isEmptyTopic, setIsEmptyTopic] = useState(false)

  // Use the custom hook
  const {
    fetchEventWithCaching,
    eventCache,
    isFromCache,
    currentOffset,
    hasMoreEvents,
    hasOlderEvents,
    resetEventState,
    handleRefreshEvent,
    handleFetchNextEvent,
    handleFetchPreviousEvent,
    handleFetchOldestEvent,
    handleFetchNewestEvent,
    isLoadingEvent,
    eventError,
    event,
  } = useFetchEventWithCaching(kafkaStore, 'JSON', onEventLoading, onEventError, setKafkaOffset)

  // Initial fetch when component mounts or topic changes or initialOffset changes
  useEffect(() => {
    if ((topicName && !currentEvent) || (topicName && currentTopic !== topicName)) {
      // Reset state when initialOffset changes
      setCurrentEvent(null)
      setCurrentTopic('')
      setIsEmptyTopic(false)

      // Determine which fetch method to use based on initialOffset
      if (initialOffset === 'latest') {
        handleFetchNewestEvent(topicName)
      } else if (initialOffset === 'earliest') {
        handleFetchOldestEvent(topicName)
      } else if (!isNaN(Number(initialOffset))) {
        // Fetch specific offset
        fetchEventWithCaching({
          topicName,
          requestType: 'offset',
          offsetParam: Number(initialOffset),
        })
      } else {
        // Default to latest if initialOffset is invalid
        handleFetchNewestEvent(topicName)
      }
    }
  }, [topicName, initialOffset, currentEvent])

  // Update currentEvent when a new event is fetched
  useEffect(() => {
    if (eventError) {
      if (eventError.includes('No events found') || eventError.includes('End of topic reached')) {
        setIsEmptyTopic(true)
        setCurrentEvent(null)
        onEmptyTopic()
        return
      }
      onEventError(eventError)
      return
    }

    if (currentOffset !== null && kafkaOffset !== null && topicName) {
      // Get the event from cache if available
      const cache = eventCache[topicName]
      if (cache && cache.events[kafkaOffset]) {
        const eventData = cache.events[kafkaOffset]

        // Create the Kafka event object
        const kafkaEvent: KafkaEventType = {
          event: eventData,
          position: initialOffset,
          kafkaOffset: kafkaOffset,
          isFromCache: isFromCache,
          topicIndex: topicIndex,
        }

        // Update local state
        setCurrentEvent(kafkaEvent)
        setCurrentTopic(topicName)
        setIsEmptyTopic(false)

        // Notify parent component
        onEventLoaded(kafkaEvent)
      } else {
        console.warn('Event not found in cache at offset:', kafkaOffset, 'for topic:', topicName)
      }
    }
  }, [currentOffset, kafkaOffset, topicName, eventCache, isFromCache, eventError])

  // Add a direct effect to handle the event from the hook
  useEffect(() => {
    if (event && topicName && !isLoadingEvent) {
      // Create the Kafka event object
      const kafkaEvent: KafkaEventType = {
        event: event,
        position: initialOffset,
        kafkaOffset: kafkaOffset || currentOffset || 0,
        isFromCache: isFromCache,
        topicIndex: topicIndex,
      }

      // Update local state
      setCurrentEvent(kafkaEvent)
      setCurrentTopic(topicName)
      setIsEmptyTopic(false)
    }
  }, [event, isLoadingEvent, topicName])

  // Wrapper functions to pass topicName and kafkaOffset to the hook methods
  const handleFetchNext = () => {
    if (kafkaOffset !== null) {
      handleFetchNextEvent(topicName, kafkaOffset)
    }
  }

  const handleFetchPrevious = () => {
    if (kafkaOffset !== null) {
      handleFetchPreviousEvent(topicName, kafkaOffset)
    }
  }

  const handleFetchOldest = () => {
    handleFetchOldestEvent(topicName)
  }

  const handleFetchNewest = () => {
    handleFetchNewestEvent(topicName)
  }

  const handleRefresh = (topic: string, fetchNext: boolean) => {
    handleRefreshEvent(topic, fetchNext)
  }

  // Check functions for button states
  const checkHasPreviousEvents = () => {
    if (kafkaOffset === null) {
      return false
    }

    // Check if we have earlier events in cache
    const cache = eventCache[topicName]
    if (cache) {
      const earlierOffsets = Object.keys(cache.events)
        .map(Number)
        .filter((offset) => offset < kafkaOffset)

      if (earlierOffsets.length > 0) {
        return true
      }
    }

    return hasOlderEvents
  }

  const checkHasNextEvents = () => {
    if (kafkaOffset === null) {
      return false
    }

    // Check if we have later events in cache
    const cache = eventCache[topicName]
    if (cache) {
      // If we're not at the latest known offset, we definitely have more events
      if (cache.latestOffset && kafkaOffset < cache.latestOffset) {
        return true
      }

      const laterOffsets = Object.keys(cache.events)
        .map(Number)
        .filter((offset) => offset > kafkaOffset)

      if (laterOffsets.length > 0) {
        return true
      }
    }

    return hasMoreEvents
  }

  return (
    <div className="flex flex-col h-full w-full min-h-[400px] overflow-auto">
      {(currentEvent?.event || isEmptyTopic) && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium step-description">Sample event</h3>
          </div>

          <EventPreview
            showInternalNavigationButtons={false}
            event={parseForCodeEditor(currentEvent?.event) || ''}
            topic={topicName}
            isLoadingEvent={isLoadingEvent && !isEmptyTopic}
            eventError={
              isEmptyTopic ? 'This topic has no events. Please enter the event schema manually.' : eventError || ''
            }
            handleRefreshEvent={handleRefresh}
            hasMoreEvents={checkHasNextEvents()}
            handleFetchPreviousEvent={handleFetchPrevious}
            handleFetchNewestEvent={handleFetchNewest}
            handleFetchOldestEvent={handleFetchOldest}
            hasOlderEvents={checkHasPreviousEvents()}
            eventPosition={kafkaOffset || 0}
            isFromCache={isFromCache}
            isEmptyTopic={isEmptyTopic}
            onEventChange={onEventChange}
          />

          {/* Only show navigation buttons when we have an event and not loading */}
          {currentEvent?.event && !isEmptyTopic && (
            <div className="flex flex-row gap-2 mt-4">
              <Button
                onClick={handleFetchPrevious}
                variant="gradient"
                className="btn-text btn-neutral"
                type="button"
                disabled={!checkHasPreviousEvents() || !topicName}
              >
                Previous Event
              </Button>
              <Button
                onClick={handleFetchNext}
                variant="gradient"
                className="btn-text btn-neutral"
                type="button"
                disabled={!checkHasNextEvents() || !topicName}
              >
                Next Event
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default EventFetcher
