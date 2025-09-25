import { NextResponse } from 'next/server'
import { generateMockPipeline } from '@/src/utils/mock-api'

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

  // Try to find existing pipeline first, fallback to generating a new one
  const { findPipeline } = await import('@/src/app/ui-api/mock/data/pipelines')
  const existingPipeline = findPipeline(id)

  if (existingPipeline) {
    return NextResponse.json({
      success: true,
      pipeline: existingPipeline,
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

  return NextResponse.json({
    success: true,
    message: `Pipeline ${id} deleted successfully`,
  })
}
