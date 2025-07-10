import { NextResponse } from 'next/server'
import { Pipeline } from '../types'
import { mockPipelines as mockPipelinesData } from '../data/pipelines'

// GET /api/mock/pipelines
export async function GET() {
  return NextResponse.json({
    success: true,
    pipelines: mockPipelinesData,
    total: mockPipelinesData.length,
  })
}

// POST /api/mock/pipelines
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const newPipeline: Pipeline = {
      id: `pipeline-${Date.now()}`,
      name: body.name || 'New Pipeline',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      config: body.config || {
        kafka: {
          topics: [],
          consumer_group: '',
        },
        clickhouse: {
          database: '',
          table: '',
        },
        operations: [],
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
