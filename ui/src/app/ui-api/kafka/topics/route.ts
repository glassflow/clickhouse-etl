import { NextResponse } from 'next/server'
import { KafkaConfig } from '@/src/lib/kafka-client'
import { getKafkaConfig } from '../../utils'
import { KafkaService } from '@/src/services/kafka-service'
import { structuredLogger } from '@/src/observability'

export async function POST(request: Request) {
  try {
    const requestBody = await request.json()

    // Base Kafka config
    const kafkaConfig = getKafkaConfig(requestBody)

    if ('success' in kafkaConfig && kafkaConfig.success === false) {
      return NextResponse.json({ success: false, error: kafkaConfig.error }, { status: 400 })
    }

    const kafkaService = new KafkaService()

    try {
      // First test the connection
      const isConnected = await kafkaService.testConnection(kafkaConfig as KafkaConfig)

      if (!isConnected) {
        return NextResponse.json({
          success: false,
          error: 'Failed to connect to Kafka cluster - kafka/topics/route.ts',
        })
      }

      // Fetch topics
      const topics = await kafkaService.getTopics(kafkaConfig as KafkaConfig)

      return NextResponse.json({
        success: true,
        topics,
      })
    } catch (error) {
      structuredLogger.error('Error fetching Kafka topics', { error: error instanceof Error ? error.message : String(error) })
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  } catch (error) {
    structuredLogger.error('Error processing Kafka topics request', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
}
