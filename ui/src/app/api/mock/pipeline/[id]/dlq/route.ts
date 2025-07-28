import { NextResponse } from 'next/server'

// Type definition for DLQ event
interface DLQEvent {
  id: string
  original_event: Record<string, any>
  error: string
  failed_at: string
  retry_count: number
}

// Mock DLQ data
const mockDLQData: Record<string, DLQEvent[]> = {
  'pipeline-001': [
    {
      id: 'dlq-event-001',
      original_event: {
        user_id: 'user-123',
        event_type: 'page_view',
        timestamp: '2024-01-15T14:44:30Z',
        data: { page: '/products', referrer: 'google.com' },
      },
      error: 'Schema validation failed: missing required field "session_id"',
      failed_at: '2024-01-15T14:44:30Z',
      retry_count: 3,
    },
    {
      id: 'dlq-event-002',
      original_event: {
        user_id: 'user-456',
        event_type: 'purchase',
        timestamp: '2024-01-15T14:43:15Z',
        data: { product_id: 'prod-789', amount: 'invalid-amount' },
      },
      error: 'Data type mismatch: expected number for field "amount", got string',
      failed_at: '2024-01-15T14:43:15Z',
      retry_count: 2,
    },
  ],
  'pipeline-003': [
    {
      id: 'dlq-event-003',
      original_event: {
        service: 'auth-service',
        level: 'ERROR',
        message: 'Authentication failed for user',
        timestamp: '2024-01-15T13:10:00Z',
      },
      error: 'Kafka connection timeout: unable to connect to kafka-1.prod:9092',
      failed_at: '2024-01-15T13:10:00Z',
      retry_count: 5,
    },
  ],
}

// GET /api/mock/pipeline/{id}/dlq
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const events = mockDLQData[id] || []

  return NextResponse.json({
    success: true,
    events,
    total: events.length,
  })
}
