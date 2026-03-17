import { KafkaService } from '@/src/services/kafka-service'
import { getKafkaConfig } from '@/src/app/ui-api/utils'
import { structuredLogger } from '@/src/observability'
import type { KafkaConnectionIntent } from '@/src/modules/ai/types'

export interface KafkaEnrichmentResult {
  connectionStatus: 'unknown' | 'valid' | 'invalid'
  availableTopics?: string[]
  error?: string
}

/**
 * Tests Kafka connectivity from a KafkaConnectionIntent.
 * Returns topics list on success. Credentials are never stored post-enrichment.
 */
export async function enrichKafkaConnection(
  intent: KafkaConnectionIntent,
  password?: string,
): Promise<KafkaEnrichmentResult> {
  if (!intent.bootstrapServers) {
    return { connectionStatus: 'unknown' }
  }

  try {
    const rawConfig: Record<string, string> = {
      servers: intent.bootstrapServers,
      securityProtocol: intent.securityProtocol || 'PLAINTEXT',
      authMethod: intent.authMethod || 'NO_AUTH',
      username: intent.username || '',
      password: password || '',
    }

    const kafkaConfig = getKafkaConfig(rawConfig)
    if ('success' in kafkaConfig && kafkaConfig.success === false) {
      return { connectionStatus: 'invalid', error: kafkaConfig.error }
    }

    const kafkaService = new KafkaService()
    const isConnected = await kafkaService.testConnection(kafkaConfig as any)
    if (!isConnected) {
      return { connectionStatus: 'invalid', error: 'Could not connect to Kafka cluster' }
    }

    const topics = await kafkaService.getTopics(kafkaConfig as any)
    return { connectionStatus: 'valid', availableTopics: topics }
  } catch (err) {
    structuredLogger.warn('Kafka enrichment failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      connectionStatus: 'invalid',
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

/**
 * Returns a redacted Kafka connection summary safe for LLM prompts.
 * Passwords and sensitive fields are replaced with [REDACTED].
 */
export function redactKafkaCredentials(intent: KafkaConnectionIntent | null): Record<string, unknown> {
  if (!intent) return {}
  return {
    bootstrapServers: intent.bootstrapServers,
    securityProtocol: intent.securityProtocol,
    authMethod: intent.authMethod,
    username: intent.username ? intent.username : undefined,
    password: intent.username ? '[REDACTED]' : undefined,
    connectionStatus: intent.connectionStatus,
    availableTopics: intent.availableTopics?.slice(0, 20), // limit to 20 topics for prompt size
  }
}
