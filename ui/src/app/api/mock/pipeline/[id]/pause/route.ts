import { NextResponse } from 'next/server'
import { generateMockPipeline } from '@/src/utils/mock-api'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  const { id } = params

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Pipeline ID is required',
      },
      { status: 400 },
    )
  }

  // Simulate 90% success rate for realistic testing
  const isSuccess = Math.random() > 0.1

  if (isSuccess) {
    const mockPipeline = generateMockPipeline(id)
    // Set state to paused
    mockPipeline.state = 'paused'
    // Convert state to status for UI
    mockPipeline.status = 'paused'

    return NextResponse.json({
      success: true,
      pipeline: mockPipeline,
    })
  } else {
    return NextResponse.json(
      {
        success: false,
        error: `Pipeline with id ${id} does not exist`,
      },
      { status: 404 },
    )
  }
}
