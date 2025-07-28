import { NextResponse } from 'next/server'

// Type definition for DLQ stats (matches backend dlqStateResponse)
interface DLQStats {
  last_received_at: string | null
  last_consumed_at: string | null
  total_messages: number
  unconsumed_messages: number
}

// Mock DLQ stats data (matches backend dlqStateResponse structure)
const mockDLQStats: Record<string, DLQStats> = {
  'pipeline-001': {
    last_received_at: '2024-01-15T14:44:30Z',
    last_consumed_at: '2024-01-15T14:42:30Z',
    total_messages: 1546899,
    unconsumed_messages: 1546899,
  },
  'pipeline-002': {
    last_received_at: '2024-01-15T13:10:00Z',
    last_consumed_at: '2024-01-15T13:08:00Z',
    total_messages: 450,
    unconsumed_messages: 125,
  },
  'pipeline-003': {
    last_received_at: '2024-01-15T12:30:00Z',
    last_consumed_at: null,
    total_messages: 250,
    unconsumed_messages: 250,
  },
  'pipeline-004': {
    last_received_at: null,
    last_consumed_at: null,
    total_messages: 0,
    unconsumed_messages: 0,
  },
}

// GET /api/mock/pipeline/{id}/dlq/state - matches backend route name
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const stats = mockDLQStats[id]

  if (!stats) {
    return NextResponse.json({ success: false, error: 'DLQ stats not found for pipeline' }, { status: 404 })
  }

  return NextResponse.json(stats)
}
