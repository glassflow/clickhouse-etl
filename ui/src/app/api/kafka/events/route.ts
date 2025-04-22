import { NextResponse } from 'next/server'
import { KafkaClient, KafkaConfig } from '@/src/lib/kafka'
import { getKafkaConfig } from '../../utils'

// Set a shorter timeout for the API route
const API_TIMEOUT = 60000 // 60 seconds

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

    // Add SSL configuration if needed
    // NOTE: This is not used in the current implementation
    // if (securityProtocol === 'SASL_SSL' || securityProtocol === 'SSL') {
    //   const { truststore } = requestBody
    //   if (truststore) {
    //     kafkaConfig.truststore = truststore
    //   }
    // }

    const kafkaClient = new KafkaClient(kafkaConfig as KafkaConfig)

    try {
      console.log(`[${new Date().toISOString()}] API: Fetching event...`)
      console.log(`[${new Date().toISOString()}] API: Current offset: ${currentOffset}`)

      if (position) {
        console.log(`[${new Date().toISOString()}] API: Using position: ${position}`)
      }

      if (direction) {
        console.log(`[${new Date().toISOString()}] API: Using direction: ${direction}`)
      }

      // Set a timeout for the entire operation
      const fetchTimeout = 30000 // 30 seconds

      let event

      try {
        // Create a promise that will reject after the timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            console.log(`[${new Date().toISOString()}] API: Aborting fetch after ${fetchTimeout}ms timeout`)
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

        console.log(`[${new Date().toISOString()}] API: Successfully fetched real event`)

        // If we requested the latest event, indicate that there are no more events
        const hasMoreEvents = position === 'latest' ? false : true

        return NextResponse.json({
          success: true,
          event,
          isMock: false,
          metadata: event._metadata || null,
          offset: event._metadata?.offset || null,
          hasMoreEvents: hasMoreEvents,
          position: position || 'default',
        })
      } catch (fetchError) {
        console.warn(`[${new Date().toISOString()}] API: Error fetching real event, using mock:`, fetchError)

        // Check if we've reached the end of the topic
        const isEndOfTopic =
          // @ts-expect-error - FIXME: fix this later
          fetchError.message &&
          // @ts-expect-error - FIXME: fix this later
          (fetchError.message.includes('end of topic') ||
            // @ts-expect-error - FIXME: fix this later
            fetchError.message.includes('no more events') ||
            // @ts-expect-error - FIXME: fix this later
            fetchError.message.includes('offset out of range') ||
            // @ts-expect-error - FIXME: fix this later
            fetchError.message.includes('has no messages'))

        if (isEndOfTopic) {
          console.log(`[${new Date().toISOString()}] API: End of topic reached`)
          return NextResponse.json({
            success: false,
            error: 'End of topic reached. No more events available.',
            hasMoreEvents: false,
          })
        }

        // If real fetch fails, use mock data
        const mockOffset = getNext && currentOffset ? parseInt(currentOffset) + 1 : 0

        event = {
          _mock: true,
          timestamp: new Date().toISOString(),
          topic: topic,
          key: `sample-key-${mockOffset}`,
          value: {
            id: Math.floor(Math.random() * 10000).toString(),
            name: 'Sample Event',
            description: `This is a mock ${getNext ? 'next' : 'first'} event because we couldn't fetch a real one`,
            properties: {
              prop1: `value-${Math.floor(Math.random() * 100)}`,
              prop2: Math.floor(Math.random() * 100),
              prop3: Math.random() > 0.5,
            },
            createdAt: new Date().toISOString(),
          },
          _metadata: {
            topic,
            partition: 0,
            offset: mockOffset.toString(),
            timestamp: Date.now().toString(),
            position: position || 'default',
          },
        }

        console.log(
          `[${new Date().toISOString()}] API: Returning response (mock: ${true}, offset: ${mockOffset}, position: ${position || 'default'})`,
        )
        return NextResponse.json({
          success: true,
          event,
          isMock: true,
          metadata: event._metadata || null,
          offset: event._metadata?.offset || null,
          hasMoreEvents: position === 'latest' ? false : true, // No more events after latest
          position: position || 'default',
        })
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] API: Error fetching sample event:`, error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] API: Error processing request:`, error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
}
