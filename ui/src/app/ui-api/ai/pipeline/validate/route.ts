import { NextResponse } from 'next/server'
import { z } from 'zod'
import { structuredLogger } from '@/src/observability'
import type { PipelineIntentModel } from '@/src/modules/ai/types'

const RequestSchema = z.object({
  sessionId: z.string().nullable(),
  intent: z.any(),
})

interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
  warnings: Record<string, string>
}

/**
 * POST /ui-api/ai/pipeline/validate
 * Validates intent completeness without materializing.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { intent } = parsed.data as { sessionId: string | null; intent: PipelineIntentModel }

    const errors: Record<string, string> = {}
    const warnings: Record<string, string> = {}

    if (!intent.topicCount) {
      errors['topicCount'] = 'Topic count not determined'
    }
    if (!intent.operationType) {
      errors['operationType'] = 'Operation type not determined'
    }
    if (!intent.kafka?.bootstrapServers) {
      errors['kafka.bootstrapServers'] = 'Kafka bootstrap servers required'
    }
    if (intent.kafka && intent.kafka.connectionStatus === 'invalid') {
      errors['kafka.connection'] = 'Kafka connection invalid'
    }
    if (!intent.topics?.length || !intent.topics[0]?.topicName) {
      errors['topics'] = 'At least one Kafka topic required'
    }
    if (intent.operationType === 'deduplication') {
      const topic = intent.topics?.[0]
      if (!topic?.deduplicationKey) {
        warnings['deduplication.key'] = 'Deduplication key not specified'
      }
    }

    const result: ValidationResult = {
      valid: Object.keys(errors).length === 0,
      errors,
      warnings,
    }

    return NextResponse.json(result)
  } catch (error) {
    structuredLogger.error('AI validate route error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}
