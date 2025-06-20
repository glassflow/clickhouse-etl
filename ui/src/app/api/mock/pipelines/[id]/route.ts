import { NextResponse } from 'next/server'

// Type definition for pipeline
interface Pipeline {
  id: string
  name: string
  status: 'running' | 'paused' | 'error' | 'stopped'
  created_at: string
  updated_at: string
  config: {
    kafka: {
      topics: string[]
      consumer_group: string
    }
    clickhouse: {
      database: string
      table: string
    }
    operations: string[]
  }
  stats: {
    events_processed: number
    events_failed: number
    throughput_per_second: number
    last_event_processed: string | null
  }
  error?: string
}

// Mock data for pipelines (shared with parent route)
const mockPipelines: Pipeline[] = [
  {
    id: 'pipeline-001',
    name: 'User Events Pipeline',
    status: 'running',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T14:45:00Z',
    config: {
      kafka: {
        topics: ['user-events', 'user-actions'],
        consumer_group: 'user-events-consumer',
      },
      clickhouse: {
        database: 'analytics',
        table: 'user_events',
      },
      operations: ['deduplication', 'transformation'],
    },
    stats: {
      events_processed: 15420,
      events_failed: 23,
      throughput_per_second: 150,
      last_event_processed: '2024-01-15T14:44:30Z',
    },
  },
  {
    id: 'pipeline-002',
    name: 'Order Processing Pipeline',
    status: 'paused',
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-15T12:20:00Z',
    config: {
      kafka: {
        topics: ['orders', 'order-updates'],
        consumer_group: 'order-consumer',
      },
      clickhouse: {
        database: 'ecommerce',
        table: 'orders',
      },
      operations: ['deduplication', 'joining'],
    },
    stats: {
      events_processed: 8920,
      events_failed: 5,
      throughput_per_second: 85,
      last_event_processed: '2024-01-15T12:19:45Z',
    },
  },
  {
    id: 'pipeline-003',
    name: 'System Logs Pipeline',
    status: 'error',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    config: {
      kafka: {
        topics: ['system-logs', 'error-logs'],
        consumer_group: 'logs-consumer',
      },
      clickhouse: {
        database: 'monitoring',
        table: 'system_logs',
      },
      operations: ['deduplication'],
    },
    stats: {
      events_processed: 4560,
      events_failed: 156,
      throughput_per_second: 0,
      last_event_processed: '2024-01-15T13:09:20Z',
    },
    error: 'Kafka connection timeout',
  },
]

// Helper function to find pipeline by ID
const findPipeline = (id: string): Pipeline | undefined => {
  return mockPipelines.find((p) => p.id === id)
}

// GET /api/mock/pipelines/{id}
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const pipeline = findPipeline(params.id)

  if (!pipeline) {
    return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, pipeline })
}

// PATCH /api/mock/pipelines/{id}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const pipeline = findPipeline(params.id)

    if (!pipeline) {
      return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
    }

    // Update pipeline
    Object.assign(pipeline, {
      ...body,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      pipeline,
      message: 'Pipeline updated successfully',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update pipeline' }, { status: 500 })
  }
}

// DELETE /api/mock/pipelines/{id}
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pipelineIndex = mockPipelines.findIndex((p) => p.id === params.id)

  if (pipelineIndex === -1) {
    return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
  }

  const deletedPipeline = mockPipelines.splice(pipelineIndex, 1)[0]

  return NextResponse.json({
    success: true,
    message: 'Pipeline deleted successfully',
    pipeline: deletedPipeline,
  })
}
