import { NextResponse } from 'next/server'
import { simulateTransition, getPipelineConfig } from '@/src/app/ui-api/mock/data/mock-state'

/**
 * Mock terminate pipeline endpoint
 * POST /ui-api/mock/pipeline/[id]/terminate
 *
 * Terminates a pipeline (permanent deletion).
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

    console.log(`[Mock] Terminating pipeline: ${id}`)

    // Simulate transitional state: Terminating -> Terminated
    simulateTransition(id, 'Terminating', 'Terminated', 2000)

    // Simulate network delay for realistic behavior
    await new Promise((resolve) => setTimeout(resolve, 300))

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} terminated successfully`,
    })
  } catch (error: any) {
    console.error('Mock Terminate Pipeline - Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: `Failed to terminate pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
