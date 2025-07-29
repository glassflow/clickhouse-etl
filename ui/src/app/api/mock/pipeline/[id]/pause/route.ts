import { NextResponse } from 'next/server'
import { mockPipelines } from '../../../data/pipelines'

// Utility function to find pipeline by ID
const findPipeline = (id: string) => {
  return mockPipelines.find((p) => p.id === id)
}

// POST /api/mock/pipeline/{id}/pause
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const pipeline = findPipeline(id)

    if (!pipeline) {
      return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 })
    }

    if (pipeline.status === 'paused') {
      return NextResponse.json({ success: false, error: 'Pipeline is already paused' }, { status: 400 })
    }

    if (pipeline.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Can only pause active pipelines' }, { status: 400 })
    }

    // Set to pausing state first
    pipeline.status = 'pausing'
    pipeline.updated_at = new Date().toISOString()

    // Simulate API processing delay (2-4 seconds)
    await new Promise((resolve) => setTimeout(resolve, 4000))

    // After delay, set to paused and return response
    pipeline.status = 'paused'
    pipeline.updated_at = new Date().toISOString()

    return NextResponse.json({
      success: true,
      pipeline,
      message: 'Pipeline has been paused successfully.',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to pause pipeline' }, { status: 500 })
  }
}
