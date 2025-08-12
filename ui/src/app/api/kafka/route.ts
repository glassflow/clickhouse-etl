import { NextResponse } from 'next/server'
import { KafkaConfig } from '@/src/lib/kafka-client'
import { getKafkaConfig } from '../utils'
import { KafkaService } from '@/src/services/kafka-service'

export async function POST(request: Request) {
  try {
    const requestBody = await request.json()
    const kafkaConfig = getKafkaConfig(requestBody)

    if ('success' in kafkaConfig && kafkaConfig.success === false) {
      return NextResponse.json({ success: false, error: kafkaConfig.error }, { status: 400 })
    }

    const kafkaService = new KafkaService()
    const isConnected = await kafkaService.testConnection(kafkaConfig as KafkaConfig)

    if (isConnected) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to Kafka cluster - Check your configuration or the Kafka cluster status',
      })
    }
  } catch (error) {
    console.error('Error testing Kafka connection:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
}
