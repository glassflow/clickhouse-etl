import { NextResponse } from 'next/server'
import { KafkaClient, KafkaConfig } from '@/src/lib/kafka-service'
import { getKafkaConfig } from '../../utils'
export async function POST(request: Request) {
  try {
    const requestBody = await request.json()

    // Base Kafka config
    const kafkaConfig = getKafkaConfig(requestBody)

    if ('success' in kafkaConfig && kafkaConfig.success === false) {
      return NextResponse.json({ success: false, error: kafkaConfig.error }, { status: 400 })
    }

    // Add SSL configuration if needed
    // if (securityProtocol === 'SASL_SSL' || securityProtocol === 'SSL') {
    //   const { truststore } = requestBody
    //   if (truststore) {
    //     kafkaConfig.truststore = truststore
    //   }
    // }

    const kafkaClient = new KafkaClient(kafkaConfig as KafkaConfig)

    try {
      // First test the connection
      const isConnected = await kafkaClient.testConnection()

      if (!isConnected) {
        return NextResponse.json({
          success: false,
          error: 'Failed to connect to Kafka cluster - kafka/topics/route.ts',
        })
      }

      // Fetch topics
      const topics = await kafkaClient.listTopics()

      return NextResponse.json({
        success: true,
        topics,
      })
    } catch (error) {
      console.error('Error fetching Kafka topics:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
}
