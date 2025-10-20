import { NextResponse } from 'next/server'
import { canStop, simulateTransition, getPipelineConfig } from '@/src/app/ui-api/mock/data/mock-state'

/**
 * Mock stop pipeline endpoint
 * POST /ui-api/mock/pipeline/[id]/stop
 *
 * Stops a running pipeline. Backend returns 204 No Content on success.
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
          error: `Pipeline with id ${id} not found`,
        },
        { status: 404 },
      )
    }

    // Validate if pipeline can be stopped
    const validation = canStop(id)
    if (!validation.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: validation.reason || 'Cannot stop pipeline',
        },
        { status: 400 },
      )
    }

    console.log(`[Mock] Stopping pipeline: ${id}`)

    // Simulate transitional state: Stopping -> Stopped
    // Real backend takes ~2-3 seconds to stop a pipeline
    simulateTransition(id, 'Stopping', 'Stopped', 2000)

    // Simulate network delay for realistic behavior
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Backend returns 204 No Content on success (no body)
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('Mock Stop Pipeline - Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: `Failed to stop pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
