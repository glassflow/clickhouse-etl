import { NextRequest, NextResponse } from 'next/server'
import { mockPipelines } from '../../data/pipelines'

// Helper function to find pipeline by ID
const findPipeline = (id: string) => {
  return mockPipelines.find((p) => p.id === id)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Debug logging
  console.log('Mock pipeline route - Requested ID:', id)
  console.log(
    'Available mock pipeline IDs:',
    mockPipelines.map((p) => p.id),
  )

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Check if pipeline exists
  const pipeline = findPipeline(id)

  if (pipeline) {
    console.log('Mock pipeline route - Found pipeline:', pipeline.name)
    return NextResponse.json({
      success: true,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        status: pipeline.status,
        created_at: pipeline.created_at,
        updated_at: pipeline.updated_at,
        transformationName: pipeline.transformationName,
        source: pipeline.source,
        join: pipeline.join,
        sink: pipeline.sink,
        stats: pipeline.stats,
        error: pipeline.error,
      },
    })
  } else {
    console.log('Mock pipeline route - Pipeline not found for ID:', id)
    return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
  }
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

    // Update pipeline name if provided
    if (body.name) {
      pipeline.name = body.name
      pipeline.updated_at = new Date().toISOString()
    }

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

    return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete pipeline' }, { status: 500 })
  }
}
