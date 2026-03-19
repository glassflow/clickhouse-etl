import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/src/store'
import { useFetchEvent } from '@/src/hooks/useFetchKafkaEvents'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export type EventFetchState = {
  event: unknown
  currentOffset: number | null
  earliestOffset: number | null
  latestOffset: number | null
  isAtLatest: boolean
  isAtEarliest?: boolean
  isLoading: boolean
  error: string | null
  isEmptyTopic: boolean
}

export interface UseTopicEventStateParams {
  index: number
  topicName: string
  offset: 'earliest' | 'latest'
  kafkaStore: import('@/src/store/kafka.store').KafkaStore
  effectiveEvent: unknown
}

export function useTopicEventState({ index, topicName, offset, kafkaStore, effectiveEvent }: UseTopicEventStateParams) {
  const analytics = useJourneyAnalytics()
  const memoizedKafkaStore = useMemo(() => kafkaStore, [kafkaStore])
  const { fetchEvent, event, isLoadingEvent, eventError, resetEventState } = useFetchEvent(memoizedKafkaStore, 'JSON')

  const lastFetchRef = useRef<{ topic: string; offset: string } | null>(null)
  const [manualEvent, setManualEvent] = useState('')
  const [isManualEventValid, setIsManualEventValid] = useState(false)
  const [state, setState] = useState<EventFetchState>({
    event: null,
    currentOffset: null,
    earliestOffset: null,
    latestOffset: null,
    isAtLatest: false,
    isLoading: false,
    error: null,
    isEmptyTopic: false,
  })

  useEffect(() => {
    if (effectiveEvent && !state.event) {
      setState((prev) => ({
        ...prev,
        event: effectiveEvent,
        isAtEarliest: offset === 'earliest',
        isAtLatest: offset === 'latest',
      }))
    }
  }, [effectiveEvent, state.event, offset])

  useEffect(() => {
    if (manualEvent) {
      try {
        JSON.parse(manualEvent)
        setIsManualEventValid(true)
      } catch {
        setIsManualEventValid(false)
      }
    } else {
      setIsManualEventValid(false)
    }
  }, [manualEvent])

  useEffect(() => {
    if (event && !isLoadingEvent && topicName) {
      setState((prev) => ({
        ...prev,
        event,
        isLoading: false,
        error: null,
      }))
      analytics.topic.eventReceived({
        topicName,
        offset: 'unknown',
        position: offset,
        eventSize: JSON.stringify(event).length,
        timestamp: new Date().toISOString(),
      })
    }
  }, [event, isLoadingEvent, topicName, offset, analytics.topic])

  useEffect(() => {
    setState((prev) => ({ ...prev, isLoading: isLoadingEvent }))
  }, [isLoadingEvent])

  useEffect(() => {
    if (eventError && topicName) {
      setState((prev) => ({
        ...prev,
        error: eventError,
        isLoading: false,
      }))
      if (eventError.includes('No more events') || eventError.includes('No previous events')) {
        analytics.topic.noEvent({
          topicName,
          position: offset,
          reason: eventError.includes('No more events') ? 'end_of_topic' : 'beginning_of_topic',
          timestamp: new Date().toISOString(),
        })
      } else {
        analytics.topic.eventError({
          topicName,
          position: offset,
          error: eventError,
          timestamp: new Date().toISOString(),
        })
      }
    }
  }, [eventError, topicName, offset, analytics.topic])

  const fetchNewestEvent = useCallback(
    async (topic: string) => {
      if (!topic) return
      setState((prev) => ({ ...prev, error: null, event: null }))
      try {
        await fetchEvent(topic, false, { position: 'latest' })
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to fetch event',
        }))
        analytics.topic.eventError({
          topicName: topic,
          position: 'latest',
          error: err instanceof Error ? err.message : 'Failed to fetch event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [fetchEvent, analytics.topic],
  )

  const fetchOldestEvent = useCallback(
    async (topic: string) => {
      if (!topic) return
      setState((prev) => ({ ...prev, error: null, event: null }))
      try {
        await fetchEvent(topic, false, { position: 'earliest' })
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to fetch event',
        }))
        analytics.topic.eventError({
          topicName: topic,
          position: 'earliest',
          error: err instanceof Error ? err.message : 'Failed to fetch event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [fetchEvent, analytics.topic],
  )

  const fetchNextEvent = useCallback(
    async (_topic: string, _currentOffset: number) => {
      if (!topicName) return
      setState((prev) => ({ ...prev, error: null, event: null }))
      try {
        await fetchEvent(topicName, true, { direction: 'next' })
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to fetch next event',
        }))
        analytics.topic.eventError({
          topicName,
          position: 'next',
          error: err instanceof Error ? err.message : 'Failed to fetch next event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [topicName, fetchEvent, analytics.topic],
  )

  const fetchPreviousEvent = useCallback(
    async (_topic: string, _currentOffset: number) => {
      if (!topicName) return
      setState((prev) => ({ ...prev, error: null, event: null }))
      try {
        await fetchEvent(topicName, false, { direction: 'previous' })
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to fetch previous event',
        }))
        analytics.topic.eventError({
          topicName,
          position: 'previous',
          error: err instanceof Error ? err.message : 'Failed to fetch previous event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [topicName, fetchEvent, analytics.topic],
  )

  const refreshEvent = useCallback(
    async (topic: string, fetchNext = false) => {
      if (!topic) return
      setState((prev) => ({ ...prev, error: null, event: null }))
      try {
        await fetchEvent(topic, fetchNext)
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to refresh event',
        }))
        analytics.topic.eventError({
          topicName: topic,
          position: 'refresh',
          error: err instanceof Error ? err.message : 'Failed to refresh event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [fetchEvent, analytics.topic],
  )

  // Only auto-fetch when there is no stored event (first visit). On revisit we show
  // the stored event and let the user refresh manually (Fetch newest / Refresh) for better UX.
  useEffect(() => {
    if (!topicName || !offset) return

    if (effectiveEvent) {
      // Revisit or edit mode: we have a stored event. Do not auto-fetch; user can
      // use "Fetch newest event" or "Refresh current event" to refresh on demand.
      return
    }

    const currentFetch = { topic: topicName, offset }
    if (
      lastFetchRef.current &&
      lastFetchRef.current.topic === currentFetch.topic &&
      lastFetchRef.current.offset === currentFetch.offset
    ) {
      return
    }

    setState((prev) => ({
      ...prev,
      event: null,
      error: null,
      isEmptyTopic: false,
      isLoading: true,
    }))
    lastFetchRef.current = currentFetch
    resetEventState()
    if (offset === 'latest') {
      fetchNewestEvent(topicName)
    } else if (offset === 'earliest') {
      fetchOldestEvent(topicName)
    }
  }, [topicName, offset, effectiveEvent, resetEventState, fetchNewestEvent, fetchOldestEvent])

  const handleManualEventChange = useCallback((eventStr: string) => {
    setManualEvent(eventStr)
    try {
      JSON.parse(eventStr)
      setIsManualEventValid(true)
    } catch {
      setIsManualEventValid(false)
    }
  }, [])

  return {
    state,
    manualEvent,
    isManualEventValid,
    fetchNewestEvent,
    fetchOldestEvent,
    fetchNextEvent,
    fetchPreviousEvent,
    refreshEvent,
    handleManualEventChange,
  }
}
