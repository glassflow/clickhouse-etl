import { NextResponse } from 'next/server'
import { z } from 'zod'
import { structuredLogger } from '@/src/observability'
import { getKafkaConfig } from '@/src/app/ui-api/utils'
import { KafkaService } from '@/src/services/kafka-service'
import { ClickhouseService } from '@/src/services/clickhouse-service'
import { buildLlmIntentResponse } from '@/src/modules/ai/llm-client'
import { redactKafkaCredentials } from '@/src/modules/ai/enrichers/kafkaEnricher'
import type { IntentApiRequest, IntentApiResponse, PipelineIntentModel } from '@/src/modules/ai/types'

const RequestSchema = z.object({
  sessionId: z.string().nullable(),
  userMessage: z.string().min(1),
  intent: z.any().nullable(),
  messages: z.array(z.any()),
  kafkaPassword: z.string().optional(),
  clickhousePassword: z.string().optional(),
})

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { sessionId, userMessage, intent, messages, kafkaPassword, clickhousePassword } = parsed.data as IntentApiRequest

    // ── 1. Deterministic enrichment: validate Kafka connection if credentials present ──
    let kafkaEnrichment: {
      connectionStatus: 'unknown' | 'valid' | 'invalid'
      availableTopics?: string[]
      error?: string
    } = { connectionStatus: 'unknown' }

    // Test Kafka when brokers are known; skip only if auth requires a password and none was provided
    const kafkaAuthMethod = (intent?.kafka?.authMethod || '').toUpperCase()
    const kafkaRequiresPassword =
      kafkaAuthMethod !== '' && kafkaAuthMethod !== 'NO_AUTH' && kafkaAuthMethod !== 'NONE'
    const canTestKafka = intent?.kafka?.bootstrapServers &&
      intent.kafka.connectionStatus !== 'valid' &&
      (!kafkaRequiresPassword || !!kafkaPassword)

    if (canTestKafka) {
      try {
        const kafkaConfigRaw = buildKafkaConfigFromIntent(intent!, kafkaPassword)
        const kafkaConfig = getKafkaConfig(kafkaConfigRaw)
        if (!('success' in kafkaConfig && kafkaConfig.success === false)) {
          const kafkaService = new KafkaService()
          const isConnected = await kafkaService.testConnection(kafkaConfig as any)
          if (isConnected) {
            const topics = await kafkaService.getTopics(kafkaConfig as any)
            kafkaEnrichment = { connectionStatus: 'valid', availableTopics: topics }
          } else {
            kafkaEnrichment = { connectionStatus: 'invalid', error: 'Could not connect to Kafka cluster' }
          }
        }
      } catch (err) {
        structuredLogger.warn('Kafka enrichment failed during AI intent', {
          error: err instanceof Error ? err.message : String(err),
        })
        kafkaEnrichment = { connectionStatus: 'invalid', error: err instanceof Error ? err.message : 'Connection failed' }
      }
    }

    // ── 2. Deterministic enrichment: validate ClickHouse connection if credentials present ──
    let clickhouseEnrichment: {
      connectionStatus: 'unknown' | 'valid' | 'invalid'
      availableTables?: string[]
      error?: string
    } = { connectionStatus: 'unknown' }

    if (intent?.clickhouse?.host && intent.clickhouse.connectionStatus !== 'valid') {
      try {
        const clickhouseService = new ClickhouseService()
        const result = await clickhouseService.testConnection({
          config: {
            host: intent.clickhouse.host,
            httpPort: intent.clickhouse.httpPort || (intent.clickhouse.useSSL !== false ? 8443 : 8123),
            nativePort: intent.clickhouse.nativePort,
            username: intent.clickhouse.username || 'default',
            password: clickhousePassword || '',
            database: intent.clickhouse.database,
            useSSL: intent.clickhouse.useSSL ?? true,
            connectionType: 'http',
            skipCertificateVerification: intent.clickhouse.skipCertificateVerification ?? false,
          },
          testType: intent.clickhouse.database ? 'database' : 'connection',
          database: intent.clickhouse.database,
        })
        if (result.success) {
          clickhouseEnrichment = {
            connectionStatus: 'valid',
            availableTables: (result as any).tables || [],
          }
        } else {
          clickhouseEnrichment = { connectionStatus: 'invalid', error: (result as any).error }
        }
      } catch (err) {
        structuredLogger.warn('ClickHouse enrichment failed during AI intent', {
          error: err instanceof Error ? err.message : String(err),
        })
        clickhouseEnrichment = {
          connectionStatus: 'invalid',
          error: err instanceof Error ? err.message : 'Connection failed',
        }
      }
    }

    // ── 3. Build enriched intent with deterministic facts ──
    const enrichedIntent: Partial<PipelineIntentModel> = {}
    if (kafkaEnrichment.connectionStatus !== 'unknown' && intent?.kafka) {
      enrichedIntent.kafka = {
        ...intent.kafka,
        connectionStatus: kafkaEnrichment.connectionStatus,
        connectionError: kafkaEnrichment.error,
        availableTopics: kafkaEnrichment.availableTopics ?? intent.kafka.availableTopics,
      }
    }
    if (clickhouseEnrichment.connectionStatus !== 'unknown' && intent?.clickhouse) {
      enrichedIntent.clickhouse = {
        ...intent.clickhouse,
        connectionStatus: clickhouseEnrichment.connectionStatus,
        connectionError: clickhouseEnrichment.error,
        availableTables: clickhouseEnrichment.availableTables ?? intent.clickhouse.availableTables,
      }
    }

    // ── 4. Call LLM for intent synthesis and assistant message ──
    const mergedIntent = intent ? { ...intent, ...enrichedIntent } : null
    const llmResponse = await buildLlmIntentResponse({
      userMessage,
      intent: mergedIntent,
      messages,
      kafkaEnrichment,
      clickhouseEnrichment,
    })

    const response: IntentApiResponse = {
      intentDelta: { ...enrichedIntent, ...llmResponse.intentDelta },
      assistantMessage: llmResponse.assistantMessage,
      unresolvedQuestions: llmResponse.unresolvedQuestions,
      docHints: llmResponse.docHints,
    }

    return NextResponse.json(response)
  } catch (error) {
    structuredLogger.error('AI intent route error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}

// Build a minimal Kafka config object from intent for connection testing
function buildKafkaConfigFromIntent(intent: PipelineIntentModel, password?: string): Record<string, string> {
  const kafka = intent.kafka
  if (!kafka) return {}
  return {
    servers: kafka.bootstrapServers || '',
    securityProtocol: kafka.securityProtocol || 'PLAINTEXT',
    authMethod: kafka.authMethod || 'NO_AUTH',
    username: kafka.username || '',
    password: password || '',
  }
}
