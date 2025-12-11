import { NextResponse } from 'next/server'
import { mockPipelines as mockPipelinesData, getMockPipelinesList, type BackendPipeline } from '../data/pipelines'
import { registerPipeline, unregisterPipeline } from '../data/mock-state'

// Helper function to validate filter expression in mock mode
// This simulates the backend's filter validation
async function validateFilterIfEnabled(
  filter: { enabled: boolean; expression: string } | undefined,
  topics: Array<{ schema?: { fields?: Array<{ name: string; type: string }> } }> | undefined,
): Promise<{ valid: boolean; error?: string }> {
  if (!filter?.enabled || !filter?.expression) {
    return { valid: true }
  }

  // Get fields from the first topic for validation (matching backend behavior)
  const firstTopic = topics?.[0]
  if (!firstTopic?.schema?.fields) {
    return { valid: true } // No schema means we can't validate
  }

  const fields = firstTopic.schema.fields.map((f) => ({
    field_name: f.name,
    field_type: f.type,
  }))

  // Use the mock filter validation endpoint logic
  try {
    // Basic validation checks (simplified version of what the validation endpoint does)
    const expression = filter.expression.trim()
    if (!expression) {
      return { valid: false, error: 'empty expression' }
    }

    // Check for balanced parentheses
    let parenCount = 0
    for (const char of expression) {
      if (char === '(') parenCount++
      if (char === ')') parenCount--
      if (parenCount < 0) {
        return { valid: false, error: 'unmatched parentheses' }
      }
    }
    if (parenCount !== 0) {
      return { valid: false, error: 'unmatched parentheses' }
    }

    return { valid: true }
  } catch (error: any) {
    return { valid: false, error: error.message || 'Filter validation failed' }
  }
}

// GET /ui-api/mock/pipeline - Returns list of pipelines (matches backend ListPipelineConfig)
export async function GET() {
  return NextResponse.json({
    success: true,
    pipelines: getMockPipelinesList(),
    total: getMockPipelinesList().length,
    // pipelines: [],
    // total: 0,
  })
}

// POST /ui-api/mock/pipeline
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate filter expression if enabled
    const filterValidation = await validateFilterIfEnabled(body.filter, body.source?.topics)
    if (!filterValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Filter validation error: ${filterValidation.error}`,
        },
        { status: 400 },
      )
    }

    // Generate a unique pipeline ID using timestamp + random string
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const pipelineId = `pipeline-${randomStr}${timestamp}`

    // Create full pipeline config with all required fields
    const newPipeline: BackendPipeline = {
      pipeline_id: pipelineId,
      name: body.name || 'New Pipeline',
      state: 'active',
      created_at: new Date().toISOString(),
      source: body.source || {
        type: 'kafka',
        provider: 'local',
        connection_params: {
          brokers: ['localhost:9092'],
          skip_auth: true,
          protocol: 'PLAINTEXT',
          mechanism: 'NO_AUTH',
          username: '',
          password: '',
          root_ca: '',
        },
        topics: [],
      },
      join: body.join || {
        type: 'temporal',
        enabled: false,
        sources: [],
      },
      // Handle filter config - preserve from request body or default to disabled
      filter: body.filter || {
        enabled: false,
        expression: '',
      },
      sink: body.sink || {
        type: 'clickhouse',
        host: '',
        http_port: '',
        port: '',
        database: '',
        username: '',
        password: '',
        secure: false,
        table: '',
        table_mapping: [],
        max_batch_size: 1000,
        max_delay_time: '60s',
        skip_certificate_verification: false,
      },
    }

    // Add to mock data array
    mockPipelinesData.push(newPipeline)

    // Register in centralized state management
    // This is crucial - without this, the pipeline won't be found by other endpoints!
    registerPipeline(pipelineId, newPipeline, 'Running')

    // Return the same format as the real API route
    return NextResponse.json({
      success: true,
      pipeline_id: pipelineId,
      status: 'active',
    })
  } catch (error) {
    console.error('[Mock] Failed to create pipeline:', error)
    return NextResponse.json({ success: false, error: 'Failed to create pipeline' }, { status: 500 })
  }
}
