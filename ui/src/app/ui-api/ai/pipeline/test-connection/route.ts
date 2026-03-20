import { NextResponse } from 'next/server'
import { z } from 'zod'
import { structuredLogger } from '@/src/observability'
import { enrichKafkaConnection } from '@/src/modules/ai/enrichers/kafkaEnricher'
import { enrichClickhouseConnection } from '@/src/modules/ai/enrichers/clickhouseEnricher'
import type { DeepPartial, PipelineIntentModel } from '@/src/modules/ai/types'

const RequestSchema = z.object({
  intent: z.any(),
  kafkaPassword: z.string().optional(),
  clickhousePassword: z.string().optional(),
})

export interface TestConnectionResponse {
  intentDelta: DeepPartial<PipelineIntentModel>
  summary: {
    kafka?: string
    clickhouse?: string
  }
}

/**
 * POST /ui-api/ai/pipeline/test-connection
 * Tests Kafka and/or ClickHouse connections without calling the LLM.
 * Used by the "Test Connections" button in the AI summary panel for immediate feedback.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { intent, kafkaPassword, clickhousePassword } = parsed.data

    const intentDelta: DeepPartial<PipelineIntentModel> = {}
    const summary: { kafka?: string; clickhouse?: string } = {}

    // ── Test Kafka ──
    if (intent?.kafka?.bootstrapServers && intent.kafka.connectionStatus !== 'valid') {
      const result = await enrichKafkaConnection(intent.kafka, kafkaPassword)
      intentDelta.kafka = {
        connectionStatus: result.connectionStatus,
        connectionError: result.error,
        availableTopics: result.availableTopics ?? intent.kafka.availableTopics,
      }
      if (result.connectionStatus === 'valid') {
        const topicCount = result.availableTopics?.length ?? 0
        summary.kafka = `Kafka connected — ${topicCount} topic${topicCount !== 1 ? 's' : ''} available.`
      } else {
        summary.kafka = `Kafka failed: ${result.error ?? 'Could not connect to cluster'}`
      }
    }

    // ── Test ClickHouse ──
    if (intent?.clickhouse?.host && intent.clickhouse.connectionStatus !== 'valid') {
      const result = await enrichClickhouseConnection(intent.clickhouse, clickhousePassword)
      intentDelta.clickhouse = {
        connectionStatus: result.connectionStatus,
        connectionError: result.error,
        availableTables: result.availableTables ?? intent.clickhouse.availableTables,
        availableDatabases: result.availableDatabases ?? intent.clickhouse.availableDatabases,
      }
      if (result.connectionStatus === 'valid') {
        const tableCount = result.availableTables?.length ?? 0
        summary.clickhouse = `ClickHouse connected — ${tableCount} table${tableCount !== 1 ? 's' : ''} available.`
      } else {
        summary.clickhouse = `ClickHouse failed: ${result.error ?? 'Could not connect'}`
      }
    }

    const response: TestConnectionResponse = { intentDelta, summary }
    return NextResponse.json(response)
  } catch (error) {
    structuredLogger.error('test-connection route error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}
