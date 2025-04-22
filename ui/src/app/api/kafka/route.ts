import { NextResponse } from 'next/server'
import { KafkaClient, KafkaConfig } from '@/src/lib/kafka'
import { getKafkaConfig } from '../utils'

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url)
//   const brokers = searchParams.get('brokers')?.split(',') || []
//   const username = searchParams.get('username')
//   const password = searchParams.get('password')
//   const groupId = searchParams.get('groupId')

//   if (!brokers.length || !username || !password || !groupId) {
//     return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 })
//   }

//   const kafkaClient = new KafkaClient({
//     brokers,
//     username,
//     password,
//     clientId: 'kafka-local-test',
//     groupId,
//   })

//   try {
//     const isConnected = await kafkaClient.testConnection()

//     if (!isConnected) {
//       throw new Error('Failed to connect to Kafka cluster - kafka/route.ts')
//     }

//     return NextResponse.json({ success: true })
//   } catch (error) {
//     console.error('Error testing Kafka connection:', error)
//     return NextResponse.json({ success: false, error: error }, { status: 500 })
//   }
// }

export async function POST(request: Request) {
  try {
    const requestBody = await request.json()

    const kafkaConfig = getKafkaConfig(requestBody)

    if ('success' in kafkaConfig && kafkaConfig.success === false) {
      return NextResponse.json({ success: false, error: kafkaConfig.error }, { status: 400 })
    }

    // Add SSL configuration if needed
    // if (securityProtocol === 'SASL_SSL' || securityProtocol === 'SSL') {
    //   const { truststore } = requestBody

    // NOTE: This is not used in the current implementation
    // if (truststore) {
    //   kafkaConfig.truststore = truststore
    // }
    // }

    const kafkaClient = new KafkaClient(kafkaConfig as KafkaConfig)
    console.log('Kafka config - Kafka Client constructor:', kafkaConfig)
    const isConnected = await kafkaClient.testConnection()

    if (isConnected) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to Kafka cluster',
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
