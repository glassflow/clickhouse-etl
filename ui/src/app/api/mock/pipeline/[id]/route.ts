import { NextResponse } from 'next/server'
import { mockPipelines } from '../../data/pipelines'
import { Pipeline } from '@/src/types/pipeline'

// Helper function to find pipeline by ID
const findPipeline = (id: string): Pipeline | undefined => {
  return mockPipelines.find((p) => p.id === id)
}

// GET /api/mock/pipeline/{id}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pipeline = findPipeline(id)

  if (!pipeline) {
    return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, pipeline })
}

// PATCH /api/mock/pipeline/{id}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const pipeline = findPipeline(id)

    if (!pipeline) {
      return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
    }

    // Update pipeline
    Object.assign(pipeline, {
      ...body,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      pipeline,
      message: 'Pipeline updated successfully',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update pipeline' }, { status: 500 })
  }
}

// DELETE /api/mock/pipeline/{id}
// Supports query parameter: ?graceful=true for graceful delete, ?graceful=false for hard delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const isGraceful = url.searchParams.get('graceful') === 'true'

    const pipeline = findPipeline(id)

    if (!pipeline) {
      return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
    }

    if (isGraceful) {
      // Graceful delete: Stop pipeline, process queue, then delete
      if (pipeline.status === 'active') {
        pipeline.status = 'deleting'
        pipeline.updated_at = new Date().toISOString()

        // Simulate graceful shutdown processing delay (3-4 seconds)
        await new Promise((resolve) => setTimeout(resolve, 3500))

        // After delay, simulate deletion completion
        // NOTE: Not actually deleting the pipeline, just simulating the delete operation
        pipeline.status = 'deleted'
        pipeline.updated_at = new Date().toISOString()

        return NextResponse.json({
          success: true,
          message: 'Pipeline has been gracefully deleted. All events in queue were processed.',
          pipeline,
          deleteType: 'graceful',
        })
      }
    } else {
      // Hard delete: Immediate deletion, discard queue
      // Add a small delay even for hard delete to show loading state
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const pipelineIndex = mockPipelines.findIndex((p) => p.id === id)
      if (pipelineIndex !== -1) {
        // NOTE: not actually deleting the pipeline, just simulating the delete operation
        pipeline.status = 'deleted'
        pipeline.updated_at = new Date().toISOString()

        return NextResponse.json({
          success: true,
          message: 'Pipeline deleted successfully (hard delete - events in queue discarded)',
          pipeline: pipeline,
          deleteType: 'hard',
        })
      }
    }

    return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete pipeline' }, { status: 500 })
  }
}
