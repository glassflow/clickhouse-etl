import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const batchSize = searchParams.get('batch_size')

  try {
    if (!id || id.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Pipeline ID is required',
        },
        { status: 400 },
      )
    }

    if (!batchSize) {
      return NextResponse.json(
        {
          success: false,
          error: 'batch_size query parameter is required',
        },
        { status: 400 },
      )
    }

    // Mock DLQ consume response
    const mockConsumedMessages = [
      {
        id: 'msg-001',
        timestamp: '2024-01-15T14:44:30Z',
        topic: 'transactions',
        partition: 0,
        offset: 12345,
        key: 'user-123',
        value: JSON.stringify({ user_id: 'user-123', amount: 150.0, currency: 'USD' }),
        headers: { source: 'kafka', version: '1.0' },
      },
      {
        id: 'msg-002',
        timestamp: '2024-01-15T14:44:31Z',
        topic: 'transactions',
        partition: 0,
        offset: 12346,
        key: 'user-124',
        value: JSON.stringify({ user_id: 'user-124', amount: 75.5, currency: 'EUR' }),
        headers: { source: 'kafka', version: '1.0' },
      },
    ]

    // Limit to batch_size if provided
    const consumedMessages = mockConsumedMessages.slice(0, parseInt(batchSize) || 10)

    return NextResponse.json({
      success: true,
      consumed_messages: consumedMessages,
      batch_size: parseInt(batchSize) || 10,
      total_consumed: consumedMessages.length,
      remaining_messages: Math.max(0, 1546899 - consumedMessages.length), // Mock remaining count
    })
  } catch (error: any) {
    console.error('Mock DLQ Consume API Route - Error details:', {
      message: error.message,
    })

    return NextResponse.json(
      {
        success: false,
        error: `Failed to consume DLQ messages for pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
