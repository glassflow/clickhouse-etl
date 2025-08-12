import { KafkaClient, KafkaConfig } from '@/src/lib/kafka-client'

const API_TIMEOUT = 30000 // 30 seconds

export class KafkaService {
  async testConnection(config: KafkaConfig): Promise<boolean> {
    const kafkaClient = new KafkaClient(config)
    return kafkaClient.testConnection()
  }

  async getTopics(config: KafkaConfig): Promise<string[]> {
    const kafkaClient = new KafkaClient(config)

    // First test the connection
    const isConnected = await kafkaClient.testConnection()
    if (!isConnected) {
      throw new Error('Failed to connect to Kafka cluster')
    }

    // Fetch topics
    const topics = await kafkaClient.listTopics()
    return topics
  }

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

    const kafkaClient = new KafkaClient(kafkaConfig)
    const fetchTimeout = API_TIMEOUT
    let event
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`API timeout after ${fetchTimeout / 1000} seconds`))
        }, fetchTimeout)
      })

      const options: any = {}
      if (position === 'latest') options.position = 'latest'
      else if (position === 'earliest') options.position = 'earliest'
      else if (direction === 'previous') options.direction = 'previous'
      if (currentPosition !== undefined) options.currentPosition = currentPosition

      event = await Promise.race([
        kafkaClient.fetchSampleEvent(topic, format, getNext, currentOffset, options),
        timeoutPromise,
      ])

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
    }
  }
}
