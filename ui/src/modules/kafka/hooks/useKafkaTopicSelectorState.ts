import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useStore } from '@/src/store'
import { useFetchEvent } from '@/src/hooks/useFetchKafkaEvents'
import { INITIAL_OFFSET_OPTIONS } from '@/src/config/constants'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import { StepKeys } from '@/src/config/constants'
import { compareEventSchemas } from '@/src/utils/common.client'

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
  const { topicsStore, deduplicationStore, kafkaStore, joinStore, clickhouseDestinationStore } = useStore()
  const analytics = useJourneyAnalytics()
  const validationEngine = useValidationEngine()

  // Memoize kafkaStore to prevent unnecessary re-renders
  const memoizedKafkaStore = useMemo(() => kafkaStore, [kafkaStore])

  // Use ref to track if we've already fetched for this topic/offset combination
  const lastFetchRef = useRef<{ topic: string; offset: string } | null>(null)

  // ✅ Store original topic state when entering edit mode (before any changes)
  // This is used for schema comparison to detect if schema actually changed
  const originalTopicRef = useRef<{
    name: string
    event: any
  } | null>(null)

  // Topic selection state
  const [topicName, setTopicName] = useState('')
  const [offset, setOffset] = useState<'earliest' | 'latest'>('latest')
  const [replicas, setReplicas] = useState<number>(1)

  // Get existing topic data
  const storedTopic = topicsStore.topics[index]
  const storedTopicName = storedTopic?.name
  const storedEvent = storedTopic?.selectedEvent?.event
  const storedOffset = storedTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST
  const storedReplicas = storedTopic?.replicas || 1
  const storedPartitionCount = storedTopic?.partitionCount || 0

  // Draft mode handling
  const effectiveTopic = storedTopic
  const effectiveTopicName = effectiveTopic?.name
  const effectiveEvent = effectiveTopic?.selectedEvent?.event
  const effectiveOffset = effectiveTopic?.initialOffset || INITIAL_OFFSET_OPTIONS.LATEST
  const effectiveReplicas = effectiveTopic?.replicas || 1
  const effectivePartitionCount = effectiveTopic?.partitionCount || 0

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
    if (effectiveReplicas && effectiveReplicas !== replicas) {
      setReplicas(effectiveReplicas)
    }
    // CRITICAL FIX: Initialize state.event with existing event from store
    // This ensures that in edit mode, we have the event data available
    if (effectiveEvent && !state.event) {
      setState((prev) => ({
        ...prev,
        event: effectiveEvent,
      }))
    }
    // CRITICAL FIX: Capture original topic state when first loading in edit mode
    // This preserves the "before" state for schema comparison even if user changes topics
    if (effectiveTopicName && effectiveEvent && !originalTopicRef.current) {
      originalTopicRef.current = {
        name: effectiveTopicName,
        event: effectiveEvent,
      }
    }
  }, [effectiveTopicName, effectiveOffset, effectiveReplicas, effectiveEvent, topicName, offset, replicas, state.event])

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
      // FIX: Get fresh topic data from store to avoid stale closures
      const currentTopic = topicsStore.getTopic(index)

      // Only update if the topic actually changed
      if (currentTopic && newTopicName === currentTopic.name) {
        return
      }

      setTopicName(newTopicName)

      // When changing topic, we SHOULD clear events (different topic = different events)
      // But preserve other properties from current topic to avoid stale closure values
      const topicData = {
        ...(currentTopic || {}), // Preserve existing properties if topic exists
        index,
        name: newTopicName,
        initialOffset: currentTopic?.initialOffset || 'latest',
        events: [], // Clear events - new topic needs new events
        selectedEvent: {
          event: undefined, // Clear event - new topic needs new event
          topicIndex: index,
          position: currentTopic?.initialOffset || 'latest',
        },
        replicas: currentTopic?.replicas || 1,
        partitionCount: 0, // Will be updated when partition details are fetched
      }

      // Update store (draft or real)
      topicsStore.updateTopic(topicData)

      // FIX: Synchronize join sources when topic name changes
      // This ensures join source_id stays in sync with topic name
      if (joinStore.enabled && joinStore.streams.length > 0) {
        const updatedStreams = joinStore.streams.map((stream: any, streamIndex: number) => {
          // Update the stream that corresponds to this topic index
          if (streamIndex === index) {
            return {
              ...stream,
              topicName: newTopicName,
            }
          }
          return stream
        })
        joinStore.setStreams(updatedStreams)
      }

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
      // FIX: Get fresh topic data from store to avoid stale closures
      const currentTopic = topicsStore.getTopic(index)

      // Only update if the offset actually changed
      if (currentTopic && newOffset === currentTopic.initialOffset) {
        return
      }

      setOffset(newOffset)

      // When changing offset, we SHOULD clear events (different offset = different events)
      // But preserve other properties from current topic to avoid stale closure values
      const topicData = {
        ...(currentTopic || {}), // Preserve existing properties
        index,
        name: currentTopic?.name || '',
        initialOffset: newOffset,
        events: [], // Clear events - new offset needs new events
        selectedEvent: {
          event: undefined, // Clear event - new offset needs new event
          topicIndex: index,
          position: newOffset,
        },
        replicas: currentTopic?.replicas || 1,
        partitionCount: currentTopic?.partitionCount || 0,
      }

      // Update store (draft or real)
      topicsStore.updateTopic(topicData)
    },
    [index, topicsStore], // Minimal dependencies
  )

  // Handle replica count change
  const handleReplicaCountChange = useCallback(
    (newReplicaCount: number) => {
      // FIX: Get fresh topic data from store to avoid stale closures
      const currentTopic = topicsStore.getTopic(index)

      // Guard: only update if topic exists and replica count actually changed
      if (!currentTopic || newReplicaCount === currentTopic.replicas) {
        return
      }

      setReplicas(newReplicaCount)

      // CRITICAL: Preserve ALL existing topic data, only update replicas
      // This avoids wiping out event data that was fetched before this callback runs
      const topicData = {
        ...currentTopic, // Spread ALL existing properties (including events, selectedEvent, etc.)
        replicas: newReplicaCount, // Only override this one field
      }

      // Update store with preserved data
      topicsStore.updateTopic(topicData)
    },
    [index, topicsStore], // Minimal dependencies - only what we actually use
  )

  // Update partition count when topic details are fetched
  const updatePartitionCount = useCallback(
    (newPartitionCount: number) => {
      // FIX: Get fresh topic data from store to avoid stale closures
      const currentTopic = topicsStore.getTopic(index)

      // Guard: only update if topic exists and partition count actually changed
      if (!currentTopic || newPartitionCount === currentTopic.partitionCount) {
        return
      }

      // CRITICAL: Preserve ALL existing topic data, only update partitionCount
      // This avoids wiping out event data that was fetched before this callback runs
      const topicData = {
        ...currentTopic, // Spread ALL existing properties (including events, selectedEvent, etc.)
        partitionCount: newPartitionCount, // Only override this one field
      }

      // Update store with preserved data
      topicsStore.updateTopic(topicData)
    },
    [index, topicsStore], // Minimal dependencies - only what we actually use
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

    // CRITICAL FIX: Use original topic state for comparison, not current store
    // The store gets overwritten when user selects a different topic, so we can't rely on it
    // Instead, use the originalTopicRef which was captured when entering edit mode
    const previousTopicName = originalTopicRef.current?.name || topicsStore.topics[index]?.name
    let previousEvent = originalTopicRef.current?.event || topicsStore.topics[index]?.selectedEvent?.event

    // FALLBACK: If previousEvent doesn't exist but finalEvent does,
    // AND the topic name hasn't changed, use finalEvent as previous
    // (they're the same since we're just changing metadata for the same topic)
    // NOTE: Don't apply this fallback if topic name changed - we need to compare different events!
    if (!previousEvent && finalEvent && topicName === previousTopicName) {
      previousEvent = finalEvent
    } else if (!previousEvent && finalEvent && topicName !== previousTopicName) {
      // Topic name changed but no previous event - this means first time selecting a topic
      // Don't set previousEvent, let it stay undefined so PATH 1 invalidates
    }

    // FALLBACK 2: If we don't have a new event (e.g., just changing replica count without fetching new event),
    // use the original event for comparison
    // This prevents false invalidation when only metadata (replicas, etc.) changes
    if (!finalEvent && previousEvent) {
      finalEvent = previousEvent
    } else if (!finalEvent && !previousEvent) {
      console.warn('[Topic Submit] Neither finalEvent nor previousEvent exists!')
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
      replicas: replicas,
      partitionCount: effectivePartitionCount,
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

    // SMART INVALIDATION with TOPIC CHANGE DETECTION:
    // - Topic name changed: ALWAYS invalidate (even if schemas match)
    // - Same topic, schema changed: Invalidate
    // - Same topic, schema unchanged (offset/replica changes): Don't invalidate

    // Determine if we need to invalidate dependent sections
    let shouldInvalidate = false
    let invalidationReason = ''

    if (!previousEvent) {
      // No previous event - first time selecting event, always invalidate
      shouldInvalidate = true
      invalidationReason = 'First event selection'
    } else if (!finalEvent) {
      // No current event - this shouldn't happen now with our fallback, but handle it
      shouldInvalidate = true
      invalidationReason = 'Missing current event'
    } else if (topicName !== previousTopicName) {
      // NEW: Topic name changed - ALWAYS invalidate regardless of schema
      // This is critical for edit mode where user can now change topics
      shouldInvalidate = true
      invalidationReason = 'Topic changed'
    } else {
      // Same topic - use schema comparison to decide
      // This handles: offset changes, replica changes, event selection changes
      const schemasMatch = compareEventSchemas(previousEvent, finalEvent)

      if (!schemasMatch) {
        shouldInvalidate = true
        invalidationReason = 'Event schema changed'
      } else {
        shouldInvalidate = false
      }
    }

    // Invalidate and clear dependent sections if needed
    if (shouldInvalidate) {
      // Determine if this is a topic change (not just schema change)
      const isTopicChange = topicName !== previousTopicName

      // Clear join store data when schema or topic changes
      joinStore.setEnabled(false)
      joinStore.setType('')
      joinStore.setStreams([])

      // Mark join store as invalidated to trigger red border on join key card
      joinStore.markAsInvalidated(invalidationReason)

      // NEW: Clear deduplication config when topic changes
      // We clear this because deduplication keys are event-specific
      // FIX: Only clear dedup if it's embedded in topic selector (not a separate step)
      // In join+dedup pipelines, dedup is configured in separate TOPIC_DEDUPLICATION_CONFIGURATOR steps
      // and should only be invalidated, not cleared
      const isEmbeddedDedup = currentStep === StepKeys.TOPIC_SELECTION_1 && enableDeduplication
      if (isTopicChange && isEmbeddedDedup) {
        deduplicationStore.updateDeduplication(index, {
          enabled: false,
          window: 0,
          unit: 'hours',
          key: '',
          keyType: '',
        })
      }

      // For join+dedup pipelines, mark dedup as invalidated but don't clear it
      // User will reconfigure it in the separate dedup configurator step
      if (isTopicChange && !isEmbeddedDedup) {
        deduplicationStore.markAsInvalidated(`topic-selection-${index + 1}`)
      }

      // NEW: Clear mapping data when topic or schema changes
      const currentDestination = clickhouseDestinationStore.clickhouseDestination

      if (currentDestination && (isTopicChange || invalidationReason === 'Event schema changed')) {
        clickhouseDestinationStore.setClickhouseDestination({
          ...currentDestination,
          mapping: [], // Clear field mappings - user must remap
          // Keep database/table selections for user convenience
          // Keep destinationColumns (table schema) - still valid
        })
      }

      // Trigger validation engine to invalidate dependent sections (red borders)
      // Use string matching instead of exact StepKeys comparison since actual values are different
      if (currentStep === 'topic-selection-1' || currentStep === StepKeys.TOPIC_SELECTION_1) {
        validationEngine.invalidateSection(StepKeys.DEDUPLICATION_CONFIGURATOR, invalidationReason)
        validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, invalidationReason)
        validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, invalidationReason)
      } else if (currentStep === 'topic-selection-2' || currentStep === StepKeys.TOPIC_SELECTION_2) {
        validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, invalidationReason)
        validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, invalidationReason)
      } else if (
        currentStep === 'topic-deduplication-configurator-1' ||
        currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1
      ) {
        // For deduplication configurator, also invalidate join configurator since topic selection affects join
        validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, invalidationReason)
        validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, invalidationReason)
      } else if (
        currentStep === 'topic-deduplication-configurator-2' ||
        currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
      ) {
        // For deduplication configurator, also invalidate join configurator since topic selection affects join
        validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, invalidationReason)
        validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, invalidationReason)
      } else {
        // Fallback: always invalidate join and clickhouse for any topic selection
        if (currentStep && (currentStep.includes('topic-selection') || currentStep.includes('topic-deduplication'))) {
          validationEngine.invalidateSection(StepKeys.JOIN_CONFIGURATOR, invalidationReason)
          validationEngine.invalidateSection(StepKeys.CLICKHOUSE_MAPPER, invalidationReason)
        }
      }
    }

    // Reset original topic reference after submit
    // The next time user enters edit mode, we'll capture the new "original" state
    // This ensures each edit session starts fresh
    if (originalTopicRef.current) {
      originalTopicRef.current = {
        name: topicName,
        event: finalEvent,
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
    replicas,
    effectivePartitionCount,
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
    replicas: replicas,
    partitionCount: effectivePartitionCount,
    // NEW: Navigation state
    currentOffset: state.currentOffset,
    earliestOffset: state.earliestOffset,
    latestOffset: state.latestOffset,
    isAtLatest: state.isAtLatest,
    isAtEarliest: state.isAtEarliest,

    // Actions
    selectTopic: selectTopic,
    selectOffset: handleOffsetChange,
    selectReplicaCount: handleReplicaCountChange,
    updatePartitionCount,
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
