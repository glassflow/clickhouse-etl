import { NextResponse } from 'next/server'
import { generateMockPipeline } from '@/src/utils/mock-api'
import { getPipelineConfig, getPipelineStatus, unregisterPipeline } from '@/src/app/ui-api/mock/data/mock-state'

/**
 * Mock get pipeline endpoint
 * GET /ui-api/mock/pipeline/[id]
 *
 * Returns pipeline configuration from centralized state.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  const { id } = await params

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Pipeline ID is required',
      },
      { status: 400 },
    )
  }

  // Try to get pipeline from centralized state
  const pipelineConfig = getPipelineConfig(id)

  if (pipelineConfig) {
    // Get current status from state (may have changed from original)
    const currentStatus = getPipelineStatus(id)

    // Map status to state field for backward compatibility
    const statusToState: Record<string, string> = {
      Running: 'active',
      Paused: 'paused',
      Stopped: 'stopped',
      Terminated: 'stopped',
      Failed: 'error',
      Pausing: 'paused',
      Resuming: 'active',
      Stopping: 'stopped',
      Terminating: 'stopped',
      Created: 'active',
    }

    return NextResponse.json({
      success: true,
      pipeline: {
        ...pipelineConfig,
        state: statusToState[currentStatus] || 'active',
      },
    })
  } else {
    // For testing 404 scenarios, return 404 for specific test IDs
    const testNotFoundIds = ['non-existent-pipeline', 'deleted-pipeline-123', 'test-404-pipeline']
    if (testNotFoundIds.includes(id)) {
      return NextResponse.json(
        {
          success: false,
          error: `Pipeline with id ${id} not found`,
        },
        { status: 404 },
      )
    }

    // Generate a new pipeline for other unknown IDs
    const mockPipeline = generateMockPipeline(id)
    return NextResponse.json({
      success: true,
      pipeline: mockPipeline,
    })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  const { id } = await params
  const updates = await request.json()

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Pipeline ID is required',
      },
      { status: 400 },
    )
  }

  // Try to find existing pipeline first, fallback to generating a new one
  const { findPipeline } = await import('@/src/app/ui-api/mock/data/pipelines')
  const existingPipeline = findPipeline(id)

  const mockPipeline = existingPipeline || generateMockPipeline(id)
  // Apply updates to the mock pipeline
  if (updates.name) {
    mockPipeline.name = updates.name
  }

  return NextResponse.json({
    success: true,
    pipeline: mockPipeline,
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  const { id } = await params

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Pipeline ID is required',
      },
      { status: 400 },
    )
  }

  try {
    // Remove from centralized state
    unregisterPipeline(id)

    // Remove from mockPipelinesData array
    const { mockPipelines } = await import('@/src/app/ui-api/mock/data/pipelines')
    const index = mockPipelines.findIndex((p) => p.pipeline_id === id)
    if (index !== -1) {
      mockPipelines.splice(index, 1)
    }

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} deleted successfully`,
    })
  } catch (error) {
    console.error(`[Mock] Failed to delete pipeline ${id}:`, error)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to delete pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
