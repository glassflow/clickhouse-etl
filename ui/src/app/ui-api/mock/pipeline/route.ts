import { NextResponse } from 'next/server'
import { mockPipelines as mockPipelinesData, getMockPipelinesList, type BackendPipeline } from '../data/pipelines'
import { registerPipeline, unregisterPipeline } from '../data/mock-state'

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

    // Generate a unique pipeline ID using timestamp + random string
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const pipelineId = `pipeline-${randomStr}${timestamp}`

    console.log('[Mock] Creating new pipeline:', pipelineId)

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

    console.log('[Mock] Pipeline created and registered successfully:', pipelineId)

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
