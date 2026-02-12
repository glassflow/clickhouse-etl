import { KafkaConfig } from '@/src/lib/kafka-client-interface'
import { createKafkaClient } from '@/src/lib/kafka-client-factory'

const API_TIMEOUT = 60000 // 60 seconds - unified timeout for all Kafka operations
const CONNECTION_TIMEOUT = 60000 // 60 seconds for connection tests

export class KafkaService {
  /**
   * Test connection to Kafka broker.
   * Uses AbortController for proper timeout handling and cleanup.
   */
  async testConnection(config: KafkaConfig): Promise<boolean> {
    const kafkaClient = await createKafkaClient(config)
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), CONNECTION_TIMEOUT)

    try {
      // Pass abort signal if the client supports it
      const result = await kafkaClient.testConnection(abortController.signal)
      return result
    } catch (error) {
      if (error instanceof Error && error.message.includes('aborted')) {
        console.error('[KafkaService] Connection test timed out')
        return false
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
      try {
        await kafkaClient.disconnect()
      } catch (error) {
        console.error('[KafkaService] Error disconnecting client:', error)
      }
    }
  }

  /**
   * Get list of topics from Kafka.
   * Uses AbortController for proper timeout handling and cleanup.
   */
  async getTopics(config: KafkaConfig): Promise<string[]> {
    const kafkaClient = await createKafkaClient(config)
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), API_TIMEOUT)

    try {
      // Pass abort signal if the client supports it
      const topics = await kafkaClient.listTopics(abortController.signal)
      return topics
    } catch (error) {
      if (error instanceof Error && error.message.includes('aborted')) {
        throw new Error(`Operation timed out after ${API_TIMEOUT / 1000} seconds`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
      try {
        await kafkaClient.disconnect()
      } catch (error) {
        console.error('[KafkaService] Error disconnecting client:', error)
      }
    }
  }

  /**
   * Get topic details including partition counts.
   * Uses AbortController for proper timeout handling and cleanup.
   */
  async getTopicDetails(config: KafkaConfig): Promise<Array<{ name: string; partitionCount: number }>> {
    const kafkaClient = await createKafkaClient(config)
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), API_TIMEOUT)

    try {
      if (!kafkaClient.getTopicDetails) {
        throw new Error('getTopicDetails is not supported by this Kafka client')
      }
      // Pass abort signal if the client supports it
      const topicDetails = await kafkaClient.getTopicDetails(abortController.signal)
      return topicDetails
    } catch (error) {
      if (error instanceof Error && error.message.includes('aborted')) {
        throw new Error(`Operation timed out after ${API_TIMEOUT / 1000} seconds`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
      try {
        await kafkaClient.disconnect()
      } catch (error) {
        console.error('[KafkaService] Error disconnecting client:', error)
      }
    }
  }

  /**
   * Fetch a sample event from a Kafka topic.
   * Uses AbortController for cascading cancellation - when the API timeout triggers,
   * it properly cancels all internal operations and cleans up resources.
   */
  async fetchEvent({
    kafkaConfig,
    topic,
    format,
    getNext = false,
    currentOffset = null,
    position,
    direction,
    currentPosition,
  }: {
    kafkaConfig: KafkaConfig
    topic: string
    format?: string
    getNext?: boolean
    currentOffset?: string | null
    position?: string
    direction?: string
    currentPosition?: any
  }) {
    if (!topic) {
      return {
        success: false,
        error: 'Missing required parameters',
        status: 400,
      }
    }

    const kafkaClient = await createKafkaClient(kafkaConfig)

    // Create AbortController for cascading cancellation
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log(`[KafkaService] API timeout (${API_TIMEOUT}ms) reached, aborting operation`)
      abortController.abort()
    }, API_TIMEOUT)

    let event

    try {
      const options: any = {
        abortSignal: abortController.signal, // Pass abort signal for cascading cancellation
      }
      if (position === 'latest') options.position = 'latest'
      else if (position === 'earliest') options.position = 'earliest'
      else if (direction === 'previous') options.direction = 'previous'
      if (currentPosition !== undefined) options.currentPosition = currentPosition

      if (!kafkaClient.fetchSampleEvent) {
        throw new Error('fetchSampleEvent is not supported by this Kafka client')
      }

      // No need for Promise.race anymore - abort signal handles timeout internally
      event = await kafkaClient.fetchSampleEvent(topic, format, getNext, currentOffset, options)

      const isAtLatest = position === 'latest'
      const isAtEarliest = position === 'earliest'
      const hasMoreEvents = !isAtLatest

      return {
        success: true,
        event,
        isMock: false,
        metadata: event._metadata || null,
        offset: event._metadata?.offset || null,
        hasMoreEvents,
        isAtLatest,
        isAtEarliest,
        position: position || 'default',
      }
    } catch (fetchError: any) {
      // Handle abort/timeout errors
      const isAborted =
        fetchError instanceof Error &&
        (fetchError.message.includes('aborted') || fetchError.message.includes('Operation aborted'))

      if (isAborted) {
        return {
          success: false,
          error: `Request timed out after ${API_TIMEOUT / 1000} seconds`,
          hasMoreEvents: false,
          isAtLatest: false,
          isAtEarliest: false,
          isEmptyTopic: false,
          event: null,
        }
      }

      // Handle circuit breaker errors
      const isCircuitOpen = fetchError instanceof Error && fetchError.message.includes('Circuit breaker is open')

      if (isCircuitOpen) {
        return {
          success: false,
          error: fetchError.message,
          hasMoreEvents: false,
          isAtLatest: false,
          isAtEarliest: false,
          isEmptyTopic: false,
          event: null,
          isCircuitBreakerOpen: true,
        }
      }

      const isEndOfTopic =
        fetchError instanceof Error &&
        (fetchError.message.includes('end of topic') ||
          fetchError.message.includes('no more events') ||
          fetchError.message.includes('offset out of range') ||
          fetchError.message.includes('has no messages'))
      const isBeginningOfTopic = fetchError instanceof Error && fetchError.message.includes('beginning of topic')
      const isEmptyTopic = fetchError instanceof Error && fetchError.message.includes('no events found')

      if (isEndOfTopic) {
        return {
          success: false,
          error: 'End of topic reached. No more events available.',
          hasMoreEvents: false,
          isAtLatest: true,
          isAtEarliest: false,
          isEmptyTopic: false,
        }
      }
      if (isBeginningOfTopic) {
        return {
          success: false,
          error: 'Beginning of topic reached. No previous events available.',
          hasMoreEvents: true,
          isAtLatest: false,
          isAtEarliest: true,
          isEmptyTopic: false,
        }
      }
      if (isEmptyTopic) {
        return {
          success: false,
          error: 'No events found in this topic.',
          hasMoreEvents: false,
          isAtLatest: true,
          isAtEarliest: true,
          isEmptyTopic: true,
          event: null,
        }
      }
      return {
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Failed to fetch event',
        hasMoreEvents: false,
        isAtLatest: false,
        isAtEarliest: false,
        isEmptyTopic: false,
        event: null,
      }
    } finally {
      // Clear the timeout to prevent it from triggering after we're done
      clearTimeout(timeoutId)

      // Always disconnect to clean up resources and event listeners
      try {
        await kafkaClient.disconnect()
      } catch (error) {
        console.error('[KafkaService] Error disconnecting client:', error)
      }
    }
  }
}
