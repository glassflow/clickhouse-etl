import { NextResponse } from 'next/server'
import { canResume, simulateTransition, getPipelineConfig } from '@/src/app/ui-api/mock/data/mock-state'

/**
 * Mock resume pipeline endpoint
 * POST /ui-api/mock/pipeline/[id]/resume
 *
 * Resumes a stopped or paused pipeline.
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

    // Validate if pipeline can be resumed
    const validation = canResume(id)
    if (!validation.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: validation.reason || 'Cannot resume pipeline',
        },
        { status: 400 },
      )
    }

    console.log(`[Mock] Resuming pipeline: ${id}`)

    // Simulate transitional state: Resuming -> Running
    simulateTransition(id, 'Resuming', 'Running', 2000)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200))

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} resumed successfully`,
    })
  } catch (error: any) {
    console.error('Mock Resume Pipeline - Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: `Failed to resume pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
