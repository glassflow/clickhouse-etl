'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { EventPreview } from './EventPreview'
import { Button } from '../ui/button'
import { parseForCodeEditor } from '@/src/utils/'
import { KafkaEventType } from '@/src/scheme/topics.scheme'
import { useFetchEventWithCaching } from '../../modules/kafka/useFetchEventWithCaching'

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
  console.log('EventFetcher mounted with props:', {
    topicName,
    topicIndex,
    initialOffset,
    hasInitialEvent: !!initialEvent,
  })

  const { kafkaStore } = useStore()

  // Local state for current event
  const [currentEvent, setCurrentEvent] = useState<any>(initialEvent || null)
  const [currentTopic, setCurrentTopic] = useState<string>(topicName)
  const [isEmptyTopic, setIsEmptyTopic] = useState(false)

  // Use the custom hook
  const {
    state,
    handleFetchNewestEvent,
    handleFetchOldestEvent,
    handleFetchNextEvent,
    handleFetchPreviousEvent,
    handleRefreshEvent,
  } = useFetchEventWithCaching(kafkaStore, 'JSON', onEventLoading, onEventError, (offset) => {
    if (offset !== null) {
      setCurrentEvent((prev: any) => ({
        ...prev,
        kafkaOffset: offset,
      }))
    }
  })

  // Initial fetch when component mounts or topic changes or initialOffset changes
  useEffect(() => {
    // Only fetch if:
    // 1. We have a topic and offset AND
    // 2. Either:
    //    a. We don't have an initial event OR
    //    b. The topic or offset has changed
    const shouldFetch =
      topicName &&
      initialOffset &&
      (!initialEvent || topicName !== currentTopic || initialOffset !== currentEvent?.position)

    if (shouldFetch) {
      console.log('Fetching event because:', {
        hasInitialEvent: !!initialEvent,
        topicChanged: topicName !== currentTopic,
        offsetChanged: initialOffset !== currentEvent?.position,
      })

      // Reset state for new fetch
      setCurrentEvent(null)
      setCurrentTopic(topicName)
      setIsEmptyTopic(false)

      // Determine which fetch method to use based on initialOffset
      if (initialOffset === 'latest') {
        console.log('Fetching latest event')
        handleFetchNewestEvent(topicName)
      } else if (initialOffset === 'earliest') {
        console.log('Fetching earliest event')
        handleFetchOldestEvent(topicName)
      } else if (!isNaN(Number(initialOffset))) {
        console.log('Fetching specific offset:', initialOffset)
        handleRefreshEvent(topicName)
      } else {
        console.log('Defaulting to latest event fetch')
        handleFetchNewestEvent(topicName)
      }
    } else {
      console.log('Skipping fetch because we already have the event:', {
        topicName,
        currentTopic,
        initialOffset,
        currentPosition: currentEvent?.position,
      })
    }
  }, [topicName, initialOffset, initialEvent, currentTopic, currentEvent?.position])

  // Update currentEvent when state changes
  useEffect(() => {
    console.log('Event update effect triggered with:', {
      event: state.event,
      currentOffset: state.currentOffset,
      isLoading: state.isLoading,
      error: state.error,
      isAtEarliest: state.isAtEarliest,
      isAtLatest: state.isAtLatest,
      isEmptyTopic: state.isEmptyTopic,
    })

    if (state.isEmptyTopic) {
      console.log('Topic is empty, setting empty state')
      setCurrentEvent(null)
      setCurrentTopic(topicName)
      setIsEmptyTopic(true)
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

      console.log('Setting current event:', kafkaEvent)
      setCurrentEvent(kafkaEvent)
      setCurrentTopic(topicName)
      setIsEmptyTopic(false)
      onEventLoaded(kafkaEvent)
    }

    if (state.error) {
      console.log('Handling error state:', state.error)
      if (state.error.includes('No events found') || state.error.includes('End of topic reached')) {
        setIsEmptyTopic(true)
        setCurrentEvent(null)
        onEmptyTopic()
      } else {
        onEventError(state.error)
      }
    }
  }, [state])

  // Button action handlers
  const handleFetchNext = () => {
    console.log('Next button clicked')
    if (currentEvent && !state.isLoading) {
      console.log('Fetching next event from offset:', currentEvent.kafkaOffset)
      handleFetchNextEvent(topicName, currentEvent.kafkaOffset)
    }
  }

  const handleFetchPrevious = () => {
    console.log('Previous button clicked')
    if (currentEvent && !state.isLoading) {
      console.log('Fetching previous event from offset:', currentEvent.kafkaOffset)
      handleFetchPreviousEvent(topicName, currentEvent.kafkaOffset)
    }
  }

  const handleFetchOldest = () => {
    console.log('Oldest button clicked')
    if (topicName && !state.isLoading) {
      console.log('Fetching oldest event for topic:', topicName)
      handleFetchOldestEvent(topicName)
    }
  }

  const handleFetchNewest = () => {
    console.log('Newest button clicked')
    if (topicName && !state.isLoading) {
      console.log('Fetching newest event for topic:', topicName)
      handleFetchNewestEvent(topicName)
    }
  }

  const handleRefresh = () => {
    console.log('Refresh button clicked')
    if (topicName && !state.isLoading) {
      console.log('Refreshing current event for topic:', topicName)
      handleFetchNewestEvent(topicName)
    }
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
            event={
              isEmptyTopic
                ? '// This topic does not contain any events.\n// Please enter the event schema manually.'
                : parseForCodeEditor(currentEvent?.event) || ''
            }
            topic={topicName}
            isLoadingEvent={state.isLoading && !isEmptyTopic}
            eventError={
              isEmptyTopic ? 'This topic has no events. Please enter the event schema manually.' : state.error || ''
            }
            handleRefreshEvent={handleRefresh}
            hasMoreEvents={!state.isAtLatest}
            handleFetchPreviousEvent={handleFetchPrevious}
            handleFetchNewestEvent={handleFetchNewest}
            handleFetchOldestEvent={handleFetchOldest}
            hasOlderEvents={!state.isAtEarliest}
            eventPosition={state.currentOffset || 0}
            isAtEarliest={state.isAtEarliest}
            isAtLatest={state.isAtLatest}
            isEmptyTopic={isEmptyTopic}
            onEventChange={onEventChange}
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
