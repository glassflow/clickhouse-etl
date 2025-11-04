import { NextResponse } from 'next/server'
import { canPause, simulateTransition, getPipelineConfig } from '@/src/app/ui-api/mock/data/mock-state'

/**
 * Mock pause pipeline endpoint
 * POST /ui-api/mock/pipeline/[id]/pause
 *
 * Pauses a running pipeline.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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

    // Check if pipeline exists
    const pipeline = getPipelineConfig(id)
    if (!pipeline) {
      return NextResponse.json(
        {
          success: false,
          error: `Pipeline with id ${id} does not exist`,
        },
        { status: 404 },
      )
    }

    // Validate if pipeline can be paused
    const validation = canPause(id)
    if (!validation.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: validation.reason || 'Cannot pause pipeline',
        },
        { status: 400 },
      )
    }

    // Simulate transitional state: Pausing -> Paused
    simulateTransition(id, 'Pausing', 'Paused', 1500)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200))

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} paused successfully`,
    })
  } catch (error: any) {
    console.error('Mock Pause Pipeline - Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: `Failed to pause pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
