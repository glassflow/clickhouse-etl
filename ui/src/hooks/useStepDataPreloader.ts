import { useState, useEffect, useCallback, useRef } from 'react'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { structuredLogger } from '@/src/observability'
import { EventDataFormat } from '@/src/config/constants'
import { kafkaApiClient } from '@/src/services/kafka-api-client'

interface PreloadRequirements {
  needsTopicEvents: boolean
  topicIndices: number[]
  description: string
}

interface PreloadState {
  isLoading: boolean
  isComplete: boolean
  error: string | null
  progress: {
    current: number
    total: number
    description: string
  }
}

/**
 * Hook to pre-load data required for specific step types
 * This ensures all necessary data is available before showing the form
 */
export function useStepDataPreloader(stepKey: StepKeys, pipeline: any) {
  const { topicsStore, kafkaStore } = useStore()

  const [state, setState] = useState<PreloadState>({
    isLoading: false,
    isComplete: false,
    error: null,
    progress: { current: 0, total: 0, description: '' },
  })

  // Use refs to prevent unnecessary re-renders
  const currentStepRef = useRef<StepKeys | null>(null)
  const isPreloadingRef = useRef(false)

  // Memoize the preload requirements to prevent recalculation
  const getPreloadRequirements = useCallback((stepKey: StepKeys): PreloadRequirements => {
    // Get topic count from store at call time to prevent dependency issues
    const currentTopicCount = useStore.getState().topicsStore.topicCount

    switch (stepKey) {
      case StepKeys.TOPIC_SELECTION_1:
      case StepKeys.TOPIC_SELECTION_2:
        return {
          needsTopicEvents: true,
          topicIndices: [stepKey === StepKeys.TOPIC_SELECTION_1 ? 0 : 1],
          description: 'Loading topic event data...',
        }

      case StepKeys.DEDUPLICATION_CONFIGURATOR:
        return {
          needsTopicEvents: true,
          topicIndices: [0], // Single topic deduplication
          description: 'Loading event data for deduplication configuration...',
        }

      case StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1:
        return {
          needsTopicEvents: true,
          topicIndices: [0],
          description: 'Loading left topic event data...',
        }

      case StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2:
        return {
          needsTopicEvents: true,
          topicIndices: [1],
          description: 'Loading right topic event data...',
        }

      case StepKeys.JOIN_CONFIGURATOR:
        return {
          needsTopicEvents: true,
          topicIndices: [0, 1], // Both topics for join
          description: 'Loading event data for join configuration...',
        }

      case StepKeys.CLICKHOUSE_MAPPER:
        // Schema mapping needs all source topic events
        return {
          needsTopicEvents: true,
          topicIndices: Array.from({ length: currentTopicCount }, (_, i) => i),
          description: 'Loading source data for schema mapping...',
        }

      case StepKeys.FILTER_CONFIGURATOR:
        // Filter needs topic event for field schema
        return {
          needsTopicEvents: true,
          topicIndices: [0], // Filter applies to first topic
          description: 'Loading event data for filter configuration...',
        }

      // Steps that don't need event pre-loading
      case StepKeys.KAFKA_CONNECTION:
      case StepKeys.CLICKHOUSE_CONNECTION:
      default:
        return {
          needsTopicEvents: false,
          topicIndices: [],
          description: '',
        }
    }
  }, []) // Remove topicsStore.topicCount from dependencies to prevent loops

  // Fetch event for a specific topic if not already available
  const fetchTopicEventIfNeeded = useCallback(
    async (topicIndex: number): Promise<boolean> => {
      try {
        // Get fresh store references to avoid dependency issues
        const { topicsStore: currentTopicsStore, kafkaStore: currentKafkaStore } = useStore.getState()

        // Get fresh topic data from store at call time
        const topic = currentTopicsStore.getTopic(topicIndex)

        if (!topic || !topic.name) {
          structuredLogger.warn('useStepDataPreloader no topic configured at index', { topic_index: topicIndex })
          return false // No topic configured
        }

        // If we already have an event for this topic, skip fetching
        if (topic.selectedEvent?.event) {
          return true
        }

        // Use the kafka API client directly (like hydration functions do)
        // This way we get the actual event data back and can update the store
        const response = await kafkaApiClient.fetchEvent(currentKafkaStore, {
          topic: topic.name,
          format: EventDataFormat.JSON,
          runConsumerFirst: true,
          position: topic.initialOffset as 'earliest' | 'latest',
        })

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch event')
        }

        // Extract the event from the response
        const eventData = response.data?.event || response.event

        if (!eventData) {
          structuredLogger.warn('useStepDataPreloader no event data received for topic', { topic: topic.name })
          return false
        }

        // Update the topic in the store with the fetched event
        const updatedTopic = {
          ...topic,
          selectedEvent: {
            ...topic.selectedEvent,
            event: eventData,
          },
          events: [
            {
              event: eventData,
              topicIndex: topicIndex,
              position: topic.initialOffset,
            },
          ],
        }

        currentTopicsStore.updateTopic(updatedTopic)
        return true
      } catch (error) {
        structuredLogger.error('useStepDataPreloader failed to fetch event for topic', { topic_index: topicIndex, error: error instanceof Error ? error.message : String(error) })
        return false
      }
    },
    [], // No dependencies - get fresh store references each time
  )

  // Main preload function
  const preloadData = useCallback(async () => {
    // Prevent concurrent preloading
    if (isPreloadingRef.current) {
      return
    }

    // Check if we've already processed this step
    if (currentStepRef.current === stepKey && state.isComplete) {
      return
    }

    isPreloadingRef.current = true
    currentStepRef.current = stepKey

    try {
      const requirements = getPreloadRequirements(stepKey)

      // If no pre-loading is needed, mark as complete immediately
      if (!requirements.needsTopicEvents || requirements.topicIndices.length === 0) {
        setState({
          isLoading: false,
          isComplete: true,
          error: null,
          progress: { current: 0, total: 0, description: '' },
        })
        return
      }

      setState({
        isLoading: true,
        isComplete: false,
        error: null,
        progress: {
          current: 0,
          total: requirements.topicIndices.length,
          description: requirements.description,
        },
      })

      // Fetch events for all required topics
      for (let i = 0; i < requirements.topicIndices.length; i++) {
        const topicIndex = requirements.topicIndices[i]

        setState((prev) => ({
          ...prev,
          progress: {
            ...prev.progress,
            current: i,
            description: `${requirements.description} (${i + 1}/${requirements.topicIndices.length})`,
          },
        }))

        const success = await fetchTopicEventIfNeeded(topicIndex)

        if (!success) {
          const currentTopicsStore = useStore.getState().topicsStore
          const topic = currentTopicsStore.getTopic(topicIndex)
          const topicName = topic?.name || `topic at index ${topicIndex}`
          throw new Error(`Failed to load event data for ${topicName}`)
        }
      }

      // All data loaded successfully
      setState({
        isLoading: false,
        isComplete: true,
        error: null,
        progress: {
          current: requirements.topicIndices.length,
          total: requirements.topicIndices.length,
          description: 'Data loaded successfully',
        },
      })
    } catch (error) {
      structuredLogger.error('useStepDataPreloader preloading failed', { error: error instanceof Error ? error.message : String(error) })
      setState({
        isLoading: false,
        isComplete: false,
        error: error instanceof Error ? error.message : 'Failed to load required data',
        progress: { current: 0, total: 0, description: '' },
      })
    } finally {
      isPreloadingRef.current = false
    }
  }, [stepKey, getPreloadRequirements, fetchTopicEventIfNeeded]) // Stable dependencies

  // Auto-start preloading when step changes
  useEffect(() => {
    // Only preload if step actually changed
    if (currentStepRef.current !== stepKey) {
      preloadData()
    }
  }, [stepKey, preloadData])

  // Function to retry preloading
  const retry = useCallback(() => {
    // Reset the current step ref to force preloading
    currentStepRef.current = null
    isPreloadingRef.current = false
    preloadData()
  }, [preloadData])

  return {
    ...state,
    retry,
  }
}
