import { KafkaStore } from '@/src/store/kafka.store'
import { useFetchEvent } from '@/src/hooks/kafka-mng-hooks'
import { useState, useEffect } from 'react'
import { useEventFetchContext } from '../../components/shared/event-fetcher/EventFetchContext'

export type EventFetchState = {
  event: any
  currentOffset: number | null
  earliestOffset: number | null
  latestOffset: number | null
  isAtLatest: boolean
  isAtEarliest?: boolean
  isLoading: boolean
  error: string | null
  isEmptyTopic: boolean
}

interface FetchEventResponse {
  success: boolean
  error?: string
  event?: any // Replace with proper event type
  offset: number
  metadata: {
    earliestOffset: number
    latestOffset: number
    offset: number
  }
}

export const useFetchEventWithCaching = (
  kafka: KafkaStore,
  selectedFormat: string,
  onEventLoading: () => void,
  onEventError: (error: any) => void,
  setKafkaOffset: (offset: number) => void,
  initialOffset: string = 'latest',
  onEventLoaded?: (event: any) => void,
) => {
  const { fetchEvent, event, isLoadingEvent, eventError } = useFetchEvent(kafka, selectedFormat)
  const [currentTopic, setCurrentTopic] = useState<string | null>(null)
  const { state, setState } = useEventFetchContext()

  // Update state when event changes
  useEffect(() => {
    if (event && currentTopic && !isLoadingEvent) {
      setState((prev) => ({
        ...prev,
        event,
        isLoading: false,
        error: null,
      }))

      if (onEventLoaded) {
        onEventLoaded({
          event,
          position: initialOffset,
          kafkaOffset: state.currentOffset,
          isAtLatest: state.isAtLatest,
        })
      }
    }
  }, [event, currentTopic, isLoadingEvent])

  // Update state when error occurs
  useEffect(() => {
    if (eventError) {
      setState((prev) => ({
        ...prev,
        error: eventError,
        isLoading: false,
      }))
      onEventError(eventError)
    }
  }, [eventError])

  // Function to fetch next event
  const handleFetchNextEvent = async (topicName: string, currentOffset: number) => {
    if (!topicName || currentOffset === null) {
      console.warn('handleFetchNextEvent: Invalid parameters', { topicName, currentOffset })
      return
    }

    setCurrentTopic(topicName)
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    onEventLoading()

    try {
      const response = (await fetchEvent(topicName, true, { direction: 'next' })) as unknown as FetchEventResponse

      if (!response) {
        throw new Error('Failed to fetch next event')
      }

      // If we got an error response from the API
      if (!response.success) {
        if (response.error?.includes('End of topic reached')) {
          setState((prev) => ({
            ...prev,
            error: 'No more events available at this time. New events may arrive later.',
            isLoading: false,
          }))
          return
        }
        throw new Error(response.error || 'Failed to fetch next event')
      }

      // If we got a successful response but no event
      if (!response.event) {
        throw new Error('No event received from server')
      }

      // Update state with the new event and metadata
      setState((prev) => ({
        ...prev,
        event: response.event,
        currentOffset: response.offset,
        earliestOffset: response.metadata.earliestOffset,
        latestOffset: response.metadata.latestOffset,
        isAtLatest: response.metadata.offset === response.metadata.latestOffset,
        isLoading: false,
        error: null,
      }))
    } catch (error) {
      if (error instanceof Error) {
        if (error.message?.includes('End of topic reached') || error.message?.includes('No more events available')) {
          setState((prev) => ({
            ...prev,
            error: 'No more events available at this time. New events may arrive later.',
            isLoading: false,
          }))
        } else if (error.message?.includes('Invalid response format')) {
          setState((prev) => ({
            ...prev,
            error: 'Failed to fetch next event. Please try again.',
            isLoading: false,
          }))
        } else {
          onEventError(error)
        }
      } else {
        onEventError(error)
      }
    }
  }

  // Function to fetch previous event
  const handleFetchPreviousEvent = async (topicName: string, currentOffset: number) => {
    if (!topicName || currentOffset === null) {
      console.warn('handleFetchPreviousEvent: Invalid parameters', { topicName, currentOffset })
      return
    }

    setCurrentTopic(topicName)
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    onEventLoading()

    try {
      const response = (await fetchEvent(topicName, false, { direction: 'previous' })) as unknown as FetchEventResponse

      if (!response) {
        throw new Error('Failed to fetch previous event')
      }

      // If we got an error response from the API
      if (!response.success) {
        if (response.error?.includes('Beginning of topic reached')) {
          setState((prev) => ({
            ...prev,
            error: 'You have reached the beginning of the topic. No more previous events available.',
            isLoading: false,
          }))
          return
        }
        throw new Error(response.error || 'Failed to fetch previous event')
      }

      // If we got a successful response but no event
      if (!response.event) {
        throw new Error('No event received from server')
      }

      // Update state with the new event and metadata
      setState((prev) => ({
        ...prev,
        event: response.event,
        currentOffset: response.offset,
        earliestOffset: response.metadata.earliestOffset,
        latestOffset: response.metadata.latestOffset,
        isAtLatest: response.metadata.offset === response.metadata.latestOffset,
        isLoading: false,
        error: null,
      }))
    } catch (error) {
      if (error instanceof Error) {
        if (error.message?.includes('Beginning of topic reached')) {
          setState((prev) => ({
            ...prev,
            error: 'You have reached the beginning of the topic. No more previous events available.',
            isLoading: false,
          }))
        } else if (error.message?.includes('Invalid response format')) {
          setState((prev) => ({
            ...prev,
            error: 'Failed to fetch previous event. Please try again.',
            isLoading: false,
          }))
        } else {
          onEventError(error)
        }
      } else {
        onEventError(error)
      }
    }
  }

  // Function to fetch newest event (latest)
  const handleFetchNewestEvent = async (topicName: string) => {
    if (!topicName) return

    setCurrentTopic(topicName)
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    onEventLoading()

    try {
      const response = (await fetchEvent(topicName, false, { position: 'latest' })) as unknown as FetchEventResponse

      if (!response?.metadata) {
        console.error('Invalid response format:', response)
        throw new Error('Invalid response format from server')
      }

      setState((prev) => ({
        ...prev,
        event: response.event,
        currentOffset: response.metadata.offset,
        earliestOffset: response.metadata.earliestOffset,
        latestOffset: response.metadata.latestOffset,
        isAtLatest: response.metadata.offset === response.metadata.latestOffset,
        isLoading: false,
        error: null,
      }))
    } catch (error) {
      if (error instanceof Error && error.message?.includes('No events found')) {
        setState((prev) => ({
          ...prev,
          isAtLatest: true,
          error: 'No events found in this topic',
        }))
      } else {
        onEventError(error)
      }
    }
  }

  // Function to fetch oldest event (earliest)
  const handleFetchOldestEvent = async (topicName: string) => {
    if (!topicName) return

    setCurrentTopic(topicName)
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    onEventLoading()

    try {
      const response = (await fetchEvent(topicName, false, { position: 'earliest' })) as unknown as FetchEventResponse

      if (!response?.metadata) {
        throw new Error('Invalid response format from server')
      }

      setState((prev) => ({
        ...prev,
        event: response.event,
        currentOffset: response.metadata.offset,
        earliestOffset: response.metadata.earliestOffset,
        latestOffset: response.metadata.latestOffset,
        isAtLatest: false,
        isAtEarliest: true,
        isLoading: false,
        error: null,
      }))
    } catch (error) {
      if (error instanceof Error && error.message?.includes('No events found')) {
        setState((prev) => ({
          ...prev,
          isAtLatest: true,
          isAtEarliest: true,
          error: 'No events found in this topic',
        }))
      } else {
        onEventError(error)
      }
    }
  }

  // Function to refresh current event
  const handleRefreshEvent = async (topicName: string, fetchNext: boolean = false) => {
    if (!topicName) return

    setCurrentTopic(topicName)
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    onEventLoading()

    try {
      await fetchEvent(topicName, fetchNext)
    } catch (error) {
      console.error('Error in handleRefreshEvent:', error)
      onEventError(error)
    }
  }

  return {
    state,
    handleFetchNewestEvent,
    handleFetchOldestEvent,
    handleFetchNextEvent,
    handleFetchPreviousEvent,
    handleRefreshEvent,
  }
}
