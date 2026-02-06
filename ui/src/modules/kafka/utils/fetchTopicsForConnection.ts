import type { KafkaConnectionFormType } from '@/src/scheme'
import { connectionFormToRequestBody } from './connectionToRequestBody'

/**
 * Fetches available topics from a Kafka cluster using connection form values.
 * Uses the shared request-body builder and POST /ui-api/kafka/topics.
 */
export async function fetchTopicsForConnection(connectionValues: KafkaConnectionFormType): Promise<string[]> {
  const requestBody = connectionFormToRequestBody(connectionValues)

  const response = await fetch('/ui-api/kafka/topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  const data = await response.json()

  if (data.success && data.topics) {
    return data.topics
  }
  throw new Error(data.error || 'Failed to fetch topics')
}
