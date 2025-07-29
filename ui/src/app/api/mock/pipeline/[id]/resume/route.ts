import { NextResponse } from 'next/server'
import { mockPipelines } from '../../../data/pipelines'

// Utility function to find pipeline by ID
const findPipeline = (id: string) => {
  return mockPipelines.find((p) => p.id === id)
}

// POST /api/mock/pipeline/{id}/resume
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const pipeline = findPipeline(id)

    if (!pipeline) {
      return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
    }

    if (pipeline.status === 'active') {
      return NextResponse.json({ success: false, error: 'Pipeline is already active' }, { status: 400 })
    }

    if (pipeline.status !== 'paused') {
      return NextResponse.json({ success: false, error: 'Can only resume paused pipelines' }, { status: 400 })
    }

    // Resume the pipeline immediately (no intermediate state needed)
    pipeline.status = 'active'
    pipeline.updated_at = new Date().toISOString()

    // Simulate API processing delay (2-4 seconds)
    await new Promise((resolve) => setTimeout(resolve, 4000))

    return NextResponse.json({
      success: true,
      pipeline,
      message: 'Pipeline resumed successfully',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to resume pipeline' }, { status: 500 })
  }
}
