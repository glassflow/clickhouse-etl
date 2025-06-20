import { NextResponse } from 'next/server'

// Type definition for DLQ stats
interface DLQStats {
  total_failed_events: number
  failed_events_today: number
  last_failure: string
  failure_rate: number
  top_error_types: Array<{ error_type: string; count: number }>
}

// Mock DLQ stats data
const mockDLQStats: Record<string, DLQStats> = {
  'pipeline-001': {
    total_failed_events: 23,
    failed_events_today: 5,
    last_failure: '2024-01-15T14:44:30Z',
    failure_rate: 0.15,
    top_error_types: [
      { error_type: 'Schema validation failed', count: 12 },
      { error_type: 'ClickHouse connection timeout', count: 8 },
      { error_type: 'Data type mismatch', count: 3 },
    ],
  },
  'pipeline-003': {
    total_failed_events: 156,
    failed_events_today: 45,
    last_failure: '2024-01-15T13:10:00Z',
    failure_rate: 3.4,
    top_error_types: [
      { error_type: 'Kafka connection timeout', count: 89 },
      { error_type: 'Network unreachable', count: 45 },
      { error_type: 'Authentication failed', count: 22 },
    ],
  },
}

// GET /api/mock/pipelines/{id}/dlq/stats
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const stats = mockDLQStats[params.id]

  if (!stats) {
    return NextResponse.json({ success: false, error: 'DLQ stats not found for pipeline' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    stats,
  })
}
