import { NextResponse } from 'next/server'
import { KafkaClient, KafkaConfig } from '@/src/lib/kafka'
import { getKafkaConfig } from '../../utils'

// Set a shorter timeout for the API route
const API_TIMEOUT = 30000 // 30 seconds

export async function POST(request: Request) {
  try {
    const requestBody = await request.json()

    const {
      servers,
      securityProtocol,
      authMethod,
      topic,
      format,
      getNext = false,
      currentOffset = null,
      position,
      direction,
      currentPosition,
    } = requestBody

    // Validate input
    if (!topic) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 })
    }

    // Base Kafka config
    const kafkaConfig = getKafkaConfig(requestBody)

    if ('success' in kafkaConfig && kafkaConfig.success === false) {
      return NextResponse.json({ success: false, error: kafkaConfig.error }, { status: 400 })
    }

    const kafkaClient = new KafkaClient(kafkaConfig as KafkaConfig)

    try {
      // Set a timeout for the entire operation
      const fetchTimeout = API_TIMEOUT // 15 seconds

      let event

      try {
        // Create a promise that will reject after the timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`API timeout after ${fetchTimeout / 1000} seconds`))
          }, fetchTimeout)
        })

        // Prepare options for fetchSampleEvent
        const options: any = {}

        if (position === 'latest') {
          options.position = 'latest'
        } else if (position === 'earliest') {
          options.position = 'earliest'
        } else if (direction === 'previous') {
          options.direction = 'previous'
        }

        if (currentPosition !== undefined) {
          options.currentPosition = currentPosition
        }

        // Race between the fetch and the timeout
        event = await Promise.race([
          kafkaClient.fetchSampleEvent(topic, format, getNext, currentOffset, options),
          timeoutPromise,
        ])

        // Determine topic state
        const isAtLatest = position === 'latest'
        const isAtEarliest = position === 'earliest'
        const hasMoreEvents = !isAtLatest

        return NextResponse.json({
          success: true,
          event,
          isMock: false,
          metadata: event._metadata || null,
          offset: event._metadata?.offset || null,
          hasMoreEvents,
          isAtLatest,
          isAtEarliest,
          position: position || 'default',
        })
      } catch (fetchError) {
        // Check if we've reached the end of the topic
        const isEndOfTopic =
          fetchError instanceof Error &&
          (fetchError.message.includes('end of topic') ||
            fetchError.message.includes('no more events') ||
            fetchError.message.includes('offset out of range') ||
            fetchError.message.includes('has no messages'))

        // Check if we've reached the beginning of the topic
        const isBeginningOfTopic = fetchError instanceof Error && fetchError.message.includes('beginning of topic')

        // Check if the topic is empty
        const isEmptyTopic = fetchError instanceof Error && fetchError.message.includes('no events found')

        if (isEndOfTopic) {
          return NextResponse.json({
            success: false,
            error: 'End of topic reached. No more events available.',
            hasMoreEvents: false,
            isAtLatest: true,
            isAtEarliest: false,
            isEmptyTopic: false,
          })
        }

        if (isBeginningOfTopic) {
          return NextResponse.json({
            success: false,
            error: 'Beginning of topic reached. No previous events available.',
            hasMoreEvents: true,
            isAtLatest: false,
            isAtEarliest: true,
            isEmptyTopic: false,
          })
        }

        if (isEmptyTopic) {
          return NextResponse.json({
            success: false,
            error: 'No events found in this topic.',
            hasMoreEvents: false,
            isAtLatest: true,
            isAtEarliest: true,
            isEmptyTopic: true,
            event: null,
          })
        }

        // If real fetch fails, return error
        return NextResponse.json({
          success: false,
          error: fetchError instanceof Error ? fetchError.message : 'Failed to fetch event',
          hasMoreEvents: false,
          isAtLatest: false,
          isAtEarliest: false,
          isEmptyTopic: false,
          event: null,
        })
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        hasMoreEvents: false,
        isAtLatest: false,
        isAtEarliest: false,
        isEmptyTopic: false,
        event: null,
      })
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        hasMoreEvents: false,
        isAtLatest: false,
        isAtEarliest: false,
        isEmptyTopic: false,
        event: null,
      },
      { status: 500 },
    )
  }
}
