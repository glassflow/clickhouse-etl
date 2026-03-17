import { NextResponse } from 'next/server'
import { z } from 'zod'
import { structuredLogger } from '@/src/observability'
import type { GenerateApiRequest, GenerateApiResponse } from '@/src/modules/ai/types'

const RequestSchema = z.object({
  sessionId: z.string(),
  intent: z.any(),
})

/**
 * POST /ui-api/ai/pipeline/generate
 * Validates a finalized intent and returns the wizard step to navigate to.
 * Client-side materialization (`materializeIntentToStore`) handles actual store hydration.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { intent } = parsed.data as GenerateApiRequest

    // Validate intent completeness
    const validationErrors: string[] = []

    // topicCount can be inferred from topics array length if not explicitly set
    const effectiveTopicCount = intent.topicCount ?? intent.topics?.length ?? 0
    if (effectiveTopicCount < 1) {
      validationErrors.push('Topic count is required')
    }
    if (!intent.operationType) {
      validationErrors.push('Operation type is required')
    }
    if (!intent.kafka?.bootstrapServers) {
      validationErrors.push('Kafka bootstrap servers are required')
    }
    if (intent.kafka?.connectionStatus === 'invalid') {
      validationErrors.push('Kafka connection details appear to be invalid — please verify your configuration')
    }
    if (!intent.topics?.length || !intent.topics[0]?.topicName) {
      validationErrors.push('At least one Kafka topic must be selected')
    }

    if (validationErrors.length > 0) {
      const response: GenerateApiResponse = {
        success: false,
        materialized: false,
        error: validationErrors.join('; '),
      }
      return NextResponse.json(response, { status: 422 })
    }

    // Determine which wizard step to navigate to after materialization
    // If ClickHouse destination is fully specified, navigate to review
    // Otherwise navigate to ClickHouse connection step
    let stepToNavigate = 'clickhouse-connection'
    if (intent.clickhouse?.connectionStatus === 'valid' && intent.destination?.tableName) {
      stepToNavigate = 'review'
    } else if (intent.clickhouse?.connectionStatus === 'valid') {
      stepToNavigate = 'clickhouse-destination'
    }

    const response: GenerateApiResponse = {
      success: true,
      materialized: true,
      stepToNavigate,
    }

    return NextResponse.json(response)
  } catch (error) {
    structuredLogger.error('AI generate route error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { success: false, materialized: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}
