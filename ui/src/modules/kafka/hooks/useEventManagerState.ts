import { useEffect, useMemo, useState, useCallback } from 'react'
import { useStore } from '@/src/store'
import { useFetchEvent } from '@/src/hooks/useFetchKafkaEvents'
import { KafkaEventType } from '@/src/scheme/topics.scheme'

// Helper function to format event data
const formatEvent = (
  event: any,
  position: string,
  topicIndex: number,
  kafkaOffset: number = 0,
  isAtEarliest: boolean = false,
  isAtLatest: boolean = false,
): KafkaEventType => {
  return {
    event,
    position,
    kafkaOffset,
    isAtEarliest,
    isAtLatest,
    topicIndex,
  }
}

interface UseEventManagerStateProps {
  topicName: string
  initialOffset: string
  initialEvent: any
  topicIndex: number
  onEventLoading?: () => void
  onEventLoaded?: (event: KafkaEventType) => void
  onEventError?: (error: any) => void
  onEmptyTopic?: () => void
}

export function useEventManagerState({
  topicName,
  initialOffset,
  initialEvent,
  topicIndex,
  onEventLoading,
  onEventError,
  onEventLoaded,
  onEmptyTopic,
}: UseEventManagerStateProps) {
  const { kafkaStore } = useStore()

  // Local state for current event and topic tracking
  const [localState, setLocalState] = useState<{
    currentEvent: KafkaEventType | null
    currentTopic: string
    isEmptyTopic: boolean
    isLoading: boolean
    error: string | null
  }>({
    currentEvent: initialEvent ? formatEvent(initialEvent, initialOffset, topicIndex) : null,
    currentTopic: topicName,
    isEmptyTopic: false,
    isLoading: false,
    error: null,
  })

  // Event fetching hook
  const { fetchEvent, isLoadingEvent, event, eventError } = useFetchEvent(kafkaStore, 'JSON')

  // Determine if we should fetch a new event
  const shouldFetch = useMemo(() => {
    return (
      topicName &&
      initialOffset &&
      (!initialEvent || topicName !== localState.currentTopic || initialOffset !== localState.currentEvent?.position)
    )
  }, [topicName, initialOffset, initialEvent, localState.currentTopic, localState.currentEvent?.position])

  // Handle initial fetch when component mounts or topic/offset changes
  useEffect(() => {
    if (!shouldFetch) return

    // Reset state for new fetch
    setLocalState((prev) => ({
      ...prev,
      currentEvent: null,
      currentTopic: topicName,
      isEmptyTopic: false,
      isLoading: true,
      error: null,
    }))

    onEventLoading?.()

    // If we have an initial event and the topic hasn't changed, use it
    if (initialEvent && topicName === localState.currentTopic && initialOffset === localState.currentEvent?.position) {
      const formattedEvent = formatEvent(initialEvent, initialOffset, topicIndex)
      setLocalState((prev) => ({
        ...prev,
        currentEvent: formattedEvent,
        isLoading: false,
      }))
      onEventLoaded?.(formattedEvent)
      return
    }

    // Fetch new event based on offset
    fetchEvent(topicName, false, {
      position: initialOffset as 'earliest' | 'latest',
    })
  }, [
    shouldFetch,
    topicName,
    initialOffset,
    initialEvent,
    topicIndex,
    onEventLoaded,
    onEventLoading,
    onEventError,
    onEmptyTopic,
  ])

  // Handle event fetching state changes
  useEffect(() => {
    if (isLoadingEvent) {
      setLocalState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }))
      onEventLoading?.()
    } else {
      setLocalState((prev) => ({
        ...prev,
        isLoading: false,
      }))
    }
  }, [isLoadingEvent, onEventLoading])

  // Handle event errors
  useEffect(() => {
    if (eventError) {
      setLocalState((prev) => ({
        ...prev,
        error: eventError,
        isLoading: false,
      }))
      onEventError?.(eventError)
    }
  }, [eventError, onEventError])

  // Handle event loaded
  useEffect(() => {
    if (event && !isLoadingEvent) {
      const formattedEvent = formatEvent(
        event,
        initialOffset,
        topicIndex,
        0, // We don't have offset info from useFetchEvent
        false,
        false,
      )
      setLocalState((prev) => ({
        ...prev,
        currentEvent: formattedEvent,
        isLoading: false,
        isEmptyTopic: false,
      }))
      onEventLoaded?.(formattedEvent)
    }
  }, [event, isLoadingEvent, initialOffset, topicIndex, onEventLoaded])

  // Navigation action handlers
  const handleFetchNext = useCallback(() => {
    if (localState.currentEvent && !localState.isLoading) {
      // Implement next event fetching logic here
      console.log('Fetch next event')
    }
  }, [localState.currentEvent, localState.isLoading])

  const handleFetchPrevious = useCallback(() => {
    if (localState.currentEvent && !localState.isLoading) {
      // Implement previous event fetching logic here
      console.log('Fetch previous event')
    }
  }, [localState.currentEvent, localState.isLoading])

  const handleFetchNewest = useCallback(() => {
    if (topicName && !localState.isLoading) {
      // Implement newest event fetching logic here
      console.log('Fetch newest event')
    }
  }, [topicName, localState.isLoading])

  const handleFetchOldest = useCallback(() => {
    if (topicName && !localState.isLoading) {
      // Implement oldest event fetching logic here
      console.log('Fetch oldest event')
    }
  }, [topicName, localState.isLoading])

  const handleRefresh = useCallback(() => {
    if (topicName && !localState.isLoading) {
      // Implement refresh logic here
      console.log('Refresh event')
    }
  }, [topicName, localState.isLoading])

  return {
    // State
    event: localState.currentEvent,
    isLoading: localState.isLoading,
    isEmptyTopic: localState.isEmptyTopic,
    error: localState.error,

    // Actions
    fetchNext: handleFetchNext,
    fetchPrevious: handleFetchPrevious,
    fetchNewest: handleFetchNewest,
    fetchOldest: handleFetchOldest,
    refresh: handleRefresh,
  }
}
