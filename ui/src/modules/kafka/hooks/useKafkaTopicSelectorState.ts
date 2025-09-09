import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useStore } from '@/src/store'
import { useFetchEvent } from '@/src/hooks/useFetchKafkaEvents'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import { StepKeys } from '@/src/config/constants'

interface UseTopicSelectionStateProps {
  index: number
  enableDeduplication?: boolean
  onDeduplicationChange?: (config: any) => void
  initialDeduplicationConfig?: any
  currentStep?: string
}

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
  event?: any
  offset: number
  metadata: {
    earliestOffset: number
    latestOffset: number
    offset: number
  }
}

export function useKafkaTopicSelectorState({
  index,
  enableDeduplication = false,
  onDeduplicationChange,
  initialDeduplicationConfig,
  currentStep,
}: UseTopicSelectionStateProps) {
  const { topicsStore, deduplicationStore, kafkaStore, joinStore } = useStore()
  const analytics = useJourneyAnalytics()
  const validationEngine = useValidationEngine()

  // Memoize kafkaStore to prevent unnecessary re-renders
  const memoizedKafkaStore = useMemo(() => kafkaStore, [kafkaStore])

  // Use ref to track if we've already fetched for this topic/offset combination
  const lastFetchRef = useRef<{ topic: string; offset: string } | null>(null)

  // Topic selection state
  const [topicName, setTopicName] = useState('')
  const [offset, setOffset] = useState<'earliest' | 'latest'>('latest')

  // Get existing topic data
  const storedTopic = topicsStore.topics[index]
  const storedTopicName = storedTopic?.name
  const storedEvent = storedTopic?.selectedEvent?.event
  const storedOffset = storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST

  // Draft mode handling
  const effectiveTopic = storedTopic
  const effectiveTopicName = effectiveTopic?.name
  const effectiveEvent = effectiveTopic?.selectedEvent?.event
  const effectiveOffset = effectiveTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST

  // Deduplication state
  const storedDeduplicationConfig = deduplicationStore.getDeduplication(index)
  const effectiveDeduplicationConfig = storedDeduplicationConfig

  const [deduplicationConfig, setDeduplicationConfig] = useState({
    key: initialDeduplicationConfig?.key || effectiveDeduplicationConfig?.key || '',
    keyType: initialDeduplicationConfig?.keyType || effectiveDeduplicationConfig?.keyType || 'string',
    window: initialDeduplicationConfig?.window || effectiveDeduplicationConfig?.window || 1,
    unit: initialDeduplicationConfig?.unit || effectiveDeduplicationConfig?.unit || 'hours',
  })

  const [deduplicationConfigured, setDeduplicationConfigured] = useState(
    !!(initialDeduplicationConfig?.key || (effectiveDeduplicationConfig?.key && effectiveDeduplicationConfig?.window)),
  )

  // Manual event state (from KafkaTopicSelector)
  const [isManualEventValid, setIsManualEventValid] = useState(false)
  const [manualEvent, setManualEvent] = useState('')

  // Event state using the base hook
  const { fetchEvent, event, isLoadingEvent, eventError, resetEventState } = useFetchEvent(memoizedKafkaStore, 'JSON')

  // Local state for event management
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

  // Initialize from existing data
  useEffect(() => {
    if (effectiveTopicName && effectiveTopicName !== topicName) {
      setTopicName(effectiveTopicName)
    }
    if (effectiveOffset && effectiveOffset !== offset) {
      setOffset(effectiveOffset as 'earliest' | 'latest')
    }
  }, [effectiveTopicName, effectiveOffset, topicName, offset])

  // Validate manual event - enable continue button only if the manual event is valid
  useEffect(() => {
    if (manualEvent) {
      try {
        JSON.parse(manualEvent)
        setIsManualEventValid(true)
      } catch (error) {
        setIsManualEventValid(false)
      }
    } else {
      setIsManualEventValid(false)
    }
  }, [manualEvent])

  // Track page view when component loads - depending on the step, we want to track the topic selection differently
  useEffect(() => {
    // Determine if this is a join operation based on step name (more reliable than operationsSelected)
    const isJoinOperation =
      currentStep === StepKeys.TOPIC_SELECTION_2 || currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2

    if (isJoinOperation) {
      if (index === 0) {
        analytics.page.selectLeftTopic({})
      } else {
        analytics.page.selectRightTopic({})
      }
    } else {
      analytics.page.selectTopic({})
    }

    // NEW: Track deduplication page view if enabled
    if (enableDeduplication) {
      analytics.page.topicDeduplication({})
    }
  }, [enableDeduplication, index, currentStep, analytics.page])

  // Fetch event when topic or offset changes
  useEffect(() => {
    // Prevent duplicate fetches
    const currentFetch = { topic: topicName, offset }
    if (
      lastFetchRef.current &&
      lastFetchRef.current.topic === currentFetch.topic &&
      lastFetchRef.current.offset === currentFetch.offset
    ) {
      return
    }

    if (topicName && offset) {
      lastFetchRef.current = currentFetch

      // Reset event state when topic changes
      resetEventState()

      if (offset === 'latest') {
        fetchNewestEvent(topicName)
      } else if (offset === 'earliest') {
        fetchOldestEvent(topicName)
      }
    }
  }, [topicName, offset, fetchEvent, resetEventState])

  // Update state when event changes
  useEffect(() => {
    if (event && !isLoadingEvent && topicName) {
      setState((prev) => ({
        ...prev,
        event,
        isLoading: false,
        error: null,
      }))

      // Track successful event fetch
      analytics.topic.eventReceived({
        topicName,
        offset: 'unknown', // We don't have offset info from useFetchEvent
        position: offset,
        eventSize: JSON.stringify(event).length,
        timestamp: new Date().toISOString(),
      })
    }
  }, [event, isLoadingEvent, topicName, offset, analytics.topic])

  // Update loading state when isLoadingEvent changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isLoading: isLoadingEvent,
    }))
  }, [isLoadingEvent])

  // Update state when error occurs
  useEffect(() => {
    if (eventError && topicName) {
      setState((prev) => ({
        ...prev,
        error: eventError,
        isLoading: false,
      }))

      // Track error based on error type
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

  // NEW: Navigation functions (from useEventManagerState)
  const fetchNewestEvent = useCallback(
    async (topicName: string) => {
      if (!topicName) return

      // Clear previous event and error, but let useFetchEvent manage loading state
      setState((prev) => ({
        ...prev,
        error: null,
        event: null,
      }))

      try {
        // fetchEvent is a void function that updates internal state
        await fetchEvent(topicName, false, { position: 'latest' })

        // The actual event data and success/error state will be handled by the useEffect hooks
        // that monitor the event, isLoadingEvent, and eventError state from useFetchEvent
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to fetch event',
        }))

        // Track error
        analytics.topic.eventError({
          topicName,
          position: 'latest',
          error: error instanceof Error ? error.message : 'Failed to fetch event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [fetchEvent, analytics.topic],
  )

  const fetchOldestEvent = useCallback(
    async (topicName: string) => {
      if (!topicName) return

      // Clear previous event and error, but let useFetchEvent manage loading state
      setState((prev) => ({
        ...prev,
        error: null,
        event: null,
      }))

      try {
        // fetchEvent is a void function that updates internal state
        await fetchEvent(topicName, false, { position: 'earliest' })

        // The actual event data and success/error state will be handled by the useEffect hooks
        // that monitor the event, isLoadingEvent, and eventError state from useFetchEvent
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to fetch event',
        }))

        // Track error
        analytics.topic.eventError({
          topicName,
          position: 'earliest',
          error: error instanceof Error ? error.message : 'Failed to fetch event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [fetchEvent, analytics.topic],
  )

  const fetchNextEvent = useCallback(
    async (topicName: string, currentOffset: number) => {
      if (!topicName || currentOffset === null) {
        console.warn('fetchNextEvent: Invalid parameters', { topicName, currentOffset })
        return
      }

      // Clear previous event and error, but let useFetchEvent manage loading state
      setState((prev) => ({
        ...prev,
        error: null,
        event: null,
      }))

      try {
        // fetchEvent is a void function that updates internal state
        await fetchEvent(topicName, true, { direction: 'next' })

        // The actual event data and success/error state will be handled by the useEffect hooks
        // that monitor the event, isLoadingEvent, and eventError state from useFetchEvent
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to fetch next event',
        }))

        // Track error
        analytics.topic.eventError({
          topicName,
          position: 'next',
          error: error instanceof Error ? error.message : 'Failed to fetch next event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [fetchEvent, analytics.topic],
  )

  const fetchPreviousEvent = useCallback(
    async (topicName: string, currentOffset: number) => {
      if (!topicName || currentOffset === null) {
        console.warn('fetchPreviousEvent: Invalid parameters', { topicName, currentOffset })
        return
      }

      // Clear previous event and error, but let useFetchEvent manage loading state
      setState((prev) => ({
        ...prev,
        error: null,
        event: null,
      }))

      try {
        // fetchEvent is a void function that updates internal state
        await fetchEvent(topicName, false, { direction: 'previous' })

        // The actual event data and success/error state will be handled by the useEffect hooks
        // that monitor the event, isLoadingEvent, and eventError state from useFetchEvent
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to fetch previous event',
        }))

        // Track error
        analytics.topic.eventError({
          topicName,
          position: 'previous',
          error: error instanceof Error ? error.message : 'Failed to fetch previous event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [fetchEvent, analytics.topic],
  )

  const refreshEvent = useCallback(
    async (topicName: string, fetchNext: boolean = false) => {
      if (!topicName) return

      // Clear previous event and error, but let useFetchEvent manage loading state
      setState((prev) => ({
        ...prev,
        error: null,
        event: null,
      }))

      try {
        await fetchEvent(topicName, fetchNext)
      } catch (error) {
        console.error('Error in refreshEvent:', error)
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to refresh event',
        }))

        // Track refresh error
        analytics.topic.eventError({
          topicName,
          position: 'refresh',
          error: error instanceof Error ? error.message : 'Failed to refresh event',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [fetchEvent, analytics.topic],
  )

  // Handle manual event change (from KafkaTopicSelector)
  const handleManualEventChange = useCallback((event: string) => {
    setManualEvent(event)
    try {
      JSON.parse(event)
      setIsManualEventValid(true)
    } catch (error) {
      setIsManualEventValid(false)
    }
  }, [])

  // Handle topic selection
  const selectTopic = useCallback(
    (newTopicName: string) => {
      // Only update if the topic actually changed
      if (newTopicName === topicName) {
        return
      }

      setTopicName(newTopicName)

      // Create topic data
      const topicData = {
        index,
        name: newTopicName,
        initialOffset: offset,
        events: [],
        selectedEvent: {
          event: undefined,
          topicIndex: index,
          position: offset,
        },
      }

      // Update store (draft or real)
      topicsStore.updateTopic(topicData)

      // NOTE: Dependent state invalidation is now deferred until changes are saved
      // This prevents premature invalidation of dependent sections
      // The invalidation will happen in the submit function when changes are actually saved

      // NOTE: Invalidation is now deferred until changes are saved
      // This prevents premature invalidation of dependent sections
      // Invalidation will happen in the submit function when changes are actually saved

      // Analytics tracking
      analytics.topic.selected({
        offset: offset,
      })
    },
    [index, offset, topicsStore, topicName, joinStore, analytics.topic, validationEngine, currentStep],
  )

  // Handle offset change
  const handleOffsetChange = useCallback(
    (newOffset: 'earliest' | 'latest') => {
      // Only update if the offset actually changed
      if (newOffset === offset) {
        return
      }

      setOffset(newOffset)

      // Create topic data
      const topicData = {
        index,
        name: topicName,
        initialOffset: newOffset,
        events: [],
        selectedEvent: {
          event: undefined,
          topicIndex: index,
          position: newOffset,
        },
      }

      // Update store (draft or real)
      topicsStore.updateTopic(topicData)
    },
    [index, topicName, topicsStore, offset],
  )

  // Handle deduplication config change
  const handleDeduplicationConfigChange = useCallback(
    (newKeyConfig: { key: string; keyType: string }, newWindowConfig: { window: number; unit: string }) => {
      const updatedConfig = {
        key: newKeyConfig.key,
        keyType: newKeyConfig.keyType,
        window: newWindowConfig.window,
        unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
      }

      setDeduplicationConfig(updatedConfig)

      // Update deduplication status
      const isConfigured = !!(newKeyConfig.key && newWindowConfig.window)
      setDeduplicationConfigured(isConfigured)

      // Update store (draft or real)
      const deduplicationData = {
        enabled: isConfigured,
        ...updatedConfig,
      }

      deduplicationStore.updateDeduplication(index, deduplicationData)

      // NOTE: Invalidation is now deferred until changes are saved
      // This prevents premature invalidation of dependent sections
      // Invalidation will happen in the submit function when changes are actually saved

      // Notify parent component if callback provided
      if (onDeduplicationChange) {
        onDeduplicationChange(deduplicationData)
      }

      // Analytics tracking for deduplication
      if (isConfigured) {
        analytics.key.dedupKey({
          keyType: newKeyConfig.keyType,
          window: newWindowConfig.window,
          unit: newWindowConfig.unit as 'seconds' | 'minutes' | 'hours' | 'days',
        })
      }
    },
    [index, deduplicationStore, onDeduplicationChange, analytics.key, validationEngine, currentStep],
  )

  // Determine if we can continue (enhanced from KafkaTopicSelector)
  const canContinue = useMemo(() => {
    const hasValidTopic = topicName && (state.event || (manualEvent && isManualEventValid))

    if (!enableDeduplication) {
      return hasValidTopic
    }

    // For deduplication mode, also require deduplication config
    return hasValidTopic && deduplicationConfigured
  }, [topicName, state.event, manualEvent, isManualEventValid, enableDeduplication, deduplicationConfigured])

  // Submit handler (enhanced from KafkaTopicSelector)
  const handleSubmit = useCallback(() => {
    let finalEvent = null

    try {
      // if there's no event in the store, use the manual event
      finalEvent = (manualEvent ? JSON.parse(manualEvent) : null) || state.event
    } catch (e) {
      console.error('Error parsing event:', e)
      return
    }

    // Create final topic data
    const topicData = {
      index,
      name: topicName,
      initialOffset: offset,
      events: [{ event: finalEvent, topicIndex: index, position: offset, isManualEvent: manualEvent !== '' }],
      selectedEvent: {
        event: finalEvent,
        topicIndex: index,
        position: offset,
        isManualEvent: manualEvent !== '',
      },
    }

    // Check if deduplication is actually configured by looking at the config values
    const hasDeduplicationConfig = !!(deduplicationConfig.key && deduplicationConfig.window)

    const deduplicationData =
      enableDeduplication && hasDeduplicationConfig
        ? {
            enabled: true,
            window: deduplicationConfig.window,
            unit: deduplicationConfig.unit,
            key: deduplicationConfig.key,
            keyType: deduplicationConfig.keyType,
          }
        : storedDeduplicationConfig || {
            enabled: false,
            window: 0,
            unit: 'hours',
            key: '',
            keyType: '',
          }

    // Update store (draft or real)
    topicsStore.updateTopic(topicData)
    deduplicationStore.updateDeduplication(index, deduplicationData)

    // DEFERRED INVALIDATION: Now that changes are saved, invalidate dependent sections
    // This ensures invalidation only happens after changes are actually persisted

    // Clear join store when topic changes (deferred until save)
    joinStore.setEnabled(false)
    joinStore.setType('')
    joinStore.setStreams([])

    // Invalidate dependent state (deferred until save)
    // topicsStore.invalidateTopicDependentState(index)

    // Trigger validation engine to invalidate dependent sections
    // Use string matching instead of exact StepKeys comparison since actual values are different
    if (currentStep === 'topic-selection-1' || currentStep === StepKeys.TOPIC_SELECTION_1) {
      validationEngine.invalidateSection(StepKeys.DEDUPLICATION_CONFIGURATOR, 'Topic selection changed')
      validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, 'Topic selection changed')
      validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, 'Topic selection changed')
    } else if (currentStep === 'topic-selection-2' || currentStep === StepKeys.TOPIC_SELECTION_2) {
      validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, 'Topic selection changed')
      validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, 'Topic selection changed')
    } else if (
      currentStep === 'topic-deduplication-configurator-1' ||
      currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1
    ) {
      // For deduplication configurator, also invalidate join configurator since topic selection affects join
      validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, 'Topic selection changed')
      validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, 'Topic deduplication changed')
    } else if (
      currentStep === 'topic-deduplication-configurator-2' ||
      currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
    ) {
      // For deduplication configurator, also invalidate join configurator since topic selection affects join
      validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, 'Topic selection changed')
      validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, 'Topic deduplication changed')
    } else {
      // Fallback: always invalidate join and clickhouse for any topic selection
      if (currentStep && (currentStep.includes('topic-selection') || currentStep.includes('topic-deduplication'))) {
        validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, 'Topic selection changed')
        validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, 'Topic selection changed')
      }
    }
  }, [
    index,
    topicName,
    offset,
    state.event,
    manualEvent,
    enableDeduplication,
    deduplicationConfigured,
    deduplicationConfig,
    storedDeduplicationConfig,
    topicsStore,
    deduplicationStore,
    joinStore,
    validationEngine,
    currentStep,
  ])

  return {
    // State
    topicName,
    offset,
    event: state.event,
    isLoading: state.isLoading,
    isEmptyTopic: state.isEmptyTopic,
    error: state.error,
    deduplicationConfig,
    deduplicationConfigured,
    canContinue,
    manualEvent,
    isManualEventValid,
    // NEW: Navigation state
    currentOffset: state.currentOffset,
    earliestOffset: state.earliestOffset,
    latestOffset: state.latestOffset,
    isAtLatest: state.isAtLatest,
    isAtEarliest: state.isAtEarliest,

    // Actions
    selectTopic: selectTopic,
    selectOffset: handleOffsetChange,
    configureDeduplication: handleDeduplicationConfigChange,
    handleManualEventChange,
    submit: handleSubmit,
    // NEW: Navigation actions
    fetchNewestEvent,
    fetchOldestEvent,
    fetchNextEvent,
    fetchPreviousEvent,
    refreshEvent,
  }
}
