import { NextResponse } from 'next/server'
import { KafkaConfig } from '@/src/lib/kafka-client'
import { getKafkaConfig } from '../../utils'
import { KafkaService } from '@/src/services/kafka-service'

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

    const kafkaService = new KafkaService()
    const result = await kafkaService.fetchEvent({
      kafkaConfig: kafkaConfig as KafkaConfig,
      topic,
      format,
      getNext,
      currentOffset,
      position,
      direction,
      currentPosition,
    })

    // If the service returns a status, use it, otherwise default to 200
    const status = result.status || (result.success ? 200 : 500)
    // Remove status from result if present
    if ('status' in result) delete result.status
    return NextResponse.json(result, { status })
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
