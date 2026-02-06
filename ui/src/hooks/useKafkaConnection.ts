import { KafkaConnectionFormType } from '@/src/scheme'
import { useState } from 'react'
import { notify } from '@/src/notifications'
import { kafkaMessages } from '@/src/notifications/messages'
import { connectionFormToRequestBody } from '@/src/modules/kafka/utils/connectionToRequestBody'

export const useKafkaConnection = () => {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null)
  const [kafkaConnection, setKafkaConnection] = useState<KafkaConnectionFormType | null>(null)

  const testConnection = async (values: KafkaConnectionFormType): Promise<{ success: boolean; message: string }> => {
    try {
      setIsConnecting(true)
      setConnectionResult(null)

      const requestBody = connectionFormToRequestBody(values)

      const response = await fetch('/ui-api/kafka/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.success) {
        const result = {
          success: true,
          message: 'Successfully connected to Kafka cluster!',
        }
        setConnectionResult(result)
        setKafkaConnection({
          ...values,
          isConnected: true,
        })
        return result
      } else {
        const errorMessage = data.error || 'Failed to connect to Kafka cluster'
        const brokers = values.bootstrapServers || 'unknown'

        // Show notification to user
        notify(kafkaMessages.connectionFailed(brokers, errorMessage))

        const result = {
          success: false,
          message: errorMessage,
        }
        setConnectionResult(result)
        setKafkaConnection({
          ...values,
          isConnected: false,
        })
        return result
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      const brokers = values.bootstrapServers || 'unknown'

      // Show notification to user
      notify(kafkaMessages.connectionFailed(brokers, errorMessage))

      const result = {
        success: false,
        message: errorMessage,
      }
      setConnectionResult(result)
      setKafkaConnection({
        ...values,
        isConnected: false,
      })
      return result
    } finally {
      setIsConnecting(false)
    }
  }

  return { testConnection, isConnecting, connectionResult, kafkaConnection }
}
