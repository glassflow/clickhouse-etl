'use client'

import { useEffect, useState } from 'react'
import { EventEditor } from '../EventEditor'
import { parseForCodeEditor } from '@/src/utils/common.client'
import { KafkaEventType } from '@/src/scheme/topics.scheme'
import { EventFetcherProps } from './types'
import { cn } from '@/src/utils/common.client'

// NEW: Extended props to include navigation functions and state
interface ExtendedEventFetcherProps extends EventFetcherProps {
  // Navigation functions from the hook
  fetchNewestEvent?: (topicName: string) => Promise<void>
  fetchOldestEvent?: (topicName: string) => Promise<void>
  fetchNextEvent?: (topicName: string, currentOffset: number) => Promise<void>
  fetchPreviousEvent?: (topicName: string, currentOffset: number) => Promise<void>
  refreshEvent?: (topicName: string, fetchNext?: boolean) => Promise<void>

  // Navigation state from the hook
  currentOffset?: number | null
  earliestOffset?: number | null
  latestOffset?: number | null
  isAtLatest?: boolean
  isAtEarliest?: boolean
}

function EventManager({
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
  // NEW: Navigation props from hook
  fetchNewestEvent,
  fetchOldestEvent,
  fetchNextEvent,
  fetchPreviousEvent,
  refreshEvent,
  currentOffset,
  earliestOffset,
  latestOffset,
  isAtLatest,
  isAtEarliest,
}: ExtendedEventFetcherProps) {
  // Local state for current event
  const [currentEvent, setCurrentEvent] = useState<any>(() => {
    if (initialEvent) {
      return {
        event: initialEvent,
        position: initialOffset,
        kafkaOffset: currentOffset || 0,
        isAtEarliest: isAtEarliest || false,
        isAtLatest: isAtLatest || false,
        topicIndex: topicIndex,
      }
    }
    return null
  })
  const [currentTopic, setCurrentTopic] = useState<string>(topicName)
  const [isEmptyTopic, setIsEmptyTopic] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Update currentEvent when initialEvent changes (from hook)
  useEffect(() => {
    if (initialEvent) {
      const kafkaEvent: KafkaEventType = {
        event: initialEvent,
        position: initialOffset,
        kafkaOffset: currentOffset || 0,
        isAtEarliest: isAtEarliest || false,
        isAtLatest: isAtLatest || false,
        topicIndex: topicIndex,
      }
      setCurrentEvent(kafkaEvent)
      setCurrentTopic(topicName)
      setIsEmptyTopic(false)
      setIsLoading(false)
      onEventLoaded?.(kafkaEvent)
    }
  }, [initialEvent, initialOffset, currentOffset, isAtEarliest, isAtLatest, topicName, topicIndex, onEventLoaded])

  // Update when topic changes
  useEffect(() => {
    if (topicName !== currentTopic) {
      setCurrentTopic(topicName)
      setCurrentEvent(null)
      setIsEmptyTopic(false)
      setIsLoading(false)
    }
  }, [topicName, currentTopic])

  // Button action handlers using hook functions
  const handleFetchNext = () => {
    if (currentEvent && !isLoading && fetchNextEvent && currentOffset !== null && currentOffset !== undefined) {
      fetchNextEvent(topicName, currentOffset)
    }
  }

  const handleFetchPrevious = () => {
    if (currentEvent && !isLoading && fetchPreviousEvent && currentOffset !== null && currentOffset !== undefined) {
      fetchPreviousEvent(topicName, currentOffset)
    }
  }

  const handleFetchOldest = () => {
    if (topicName && !isLoading && fetchOldestEvent) {
      fetchOldestEvent(topicName)
    }
  }

  const handleFetchNewest = () => {
    if (topicName && !isLoading && fetchNewestEvent) {
      fetchNewestEvent(topicName)
    }
  }

  const handleRefresh = () => {
    if (topicName && !isLoading && refreshEvent) {
      refreshEvent(topicName)
    }
  }

  // Determine if we should show empty topic state
  const shouldShowEmptyTopic = !currentEvent?.event && !isLoading

  const eventError = shouldShowEmptyTopic ? 'This topic has no events. Please enter the event schema manually.' : ''

  return (
    <div className="flex flex-col h-full w-full min-h-[400px] overflow-auto">
      {(currentEvent?.event || shouldShowEmptyTopic || isLoading) && (
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
            isLoadingEvent={isLoading}
            eventError={eventError}
            isEmptyTopic={shouldShowEmptyTopic}
            onManualEventChange={onManualEventChange}
            isEditingEnabled={isEditingEnabled}
            readOnly={readOnly}
          />

          {/* Navigation buttons are hidden to simplify the UI */}
          {/*
          {currentEvent?.event && !shouldShowEmptyTopic && (
            <div className="flex flex-row gap-2 mt-4">
              <Button
                onClick={handleFetchPrevious}
                variant="gradient"
                className="btn-text btn-neutral"
                type="button"
                disabled={isAtEarliest || !topicName}
              >
                Previous Event
              </Button>
              <Button
                onClick={handleFetchNext}
                variant="gradient"
                className="btn-text btn-neutral"
                type="button"
                disabled={isAtLatest || !topicName}
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
export default EventManager
