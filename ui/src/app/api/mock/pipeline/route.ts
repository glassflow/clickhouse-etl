import { NextResponse } from 'next/server'
import { mockPipelines as mockPipelinesData, getMockPipelinesList } from '../data/pipelines'
import { Pipeline } from '@/src/types/pipeline'

// GET /api/mock/pipeline - Returns list of pipelines (matches backend ListPipelineConfig)
export async function GET() {
  return NextResponse.json({
    success: true,
    pipelines: getMockPipelinesList(),
    total: getMockPipelinesList().length,
    // pipelines: [],
    // total: 0,
  })
}

// POST /api/mock/pipeline
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Generate a unique pipeline ID
    const pipelineId = `pipeline-${Date.now()}`

    // You may want to validate body.source, body.join, body.sink, etc.
    const newPipeline: Pipeline = {
      pipeline_id: pipelineId,
      name: body.name || 'New Pipeline',
      state: 'active',
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
        httpPort: '',
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

    mockPipelinesData.push(newPipeline)

    // Return the same format as the real API route
    return NextResponse.json({
      success: true,
      pipeline_id: pipelineId,
      status: 'active',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create pipeline' }, { status: 500 })
  }
}
