import { NextResponse } from 'next/server'

// Type definition for pipeline
interface Pipeline {
  id: string
  name: string
  status: 'active' | 'terminated' | 'deleted' | 'paused' | 'error'
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

// Mock data for pipelines
const mockPipelines: Pipeline[] = [
  {
    id: 'pipeline-001',
    name: 'User Events Pipeline',
    status: 'active',
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

// GET /api/mock/pipelines
export async function GET() {
  return NextResponse.json({
    success: true,
    pipelines: mockPipelines,
    total: mockPipelines.length,
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

    mockPipelines.push(newPipeline)

    return NextResponse.json({
      success: true,
      pipeline: newPipeline,
      message: 'Pipeline created successfully',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create pipeline' }, { status: 500 })
  }
}
