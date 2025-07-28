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
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pipelineIndex = mockPipelines.findIndex((p) => p.id === id)

  if (pipelineIndex === -1) {
    return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
  }

  const deletedPipeline = mockPipelines.splice(pipelineIndex, 1)[0]

  return NextResponse.json({
    success: true,
    message: 'Pipeline deleted successfully',
    pipeline: deletedPipeline,
  })
}
