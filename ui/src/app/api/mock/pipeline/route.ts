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

    // You may want to validate body.source, body.join, body.sink, etc.
    const newPipeline: Pipeline = {
      id: `pipeline-${Date.now()}`,
      name: body.name || 'New Pipeline',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      transformationName: body.transformationName || '',
      source: body.source || {
        type: 'kafka',
        provider: '',
        connection_params: {
          brokers: [],
          protocol: '',
          mechanism: '',
          username: '',
          password: '',
          root_ca: '',
        },
        topics: [],
      },
      join: body.join || { enabled: false },
      sink: body.sink || {
        type: 'clickhouse',
        provider: '',
        host: '',
        port: '',
        database: '',
        username: '',
        password: '',
        secure: false,
        max_batch_size: 0,
        max_delay_time: '',
        table: '',
        table_mapping: [],
      },
      stats: {
        events_processed: 0,
        events_failed: 0,
        throughput_per_second: 0,
        last_event_processed: null,
      },
    }

    mockPipelinesData.push(newPipeline)

    return NextResponse.json({
      success: true,
      pipeline: newPipeline,
      message: 'Pipeline created successfully',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create pipeline' }, { status: 500 })
  }
}
