import { NextResponse } from 'next/server'
import { generateMockPipeline } from '@/src/utils/mock-api'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  const { id } = params

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Pipeline ID is required',
      },
      { status: 400 },
    )
  }

  // Simulate 90% success rate for realistic testing
  const isSuccess = Math.random() > 0.1

  if (isSuccess) {
    const mockPipeline = generateMockPipeline(id)
    return NextResponse.json({
      success: true,
      pipeline: mockPipeline,
    })
  } else {
    return NextResponse.json(
      {
        success: false,
        error: `Pipeline with id ${id} does not exist`,
      },
      { status: 404 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  const { id } = params
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

  // Simulate 90% success rate for realistic testing
  const isSuccess = Math.random() > 0.1

  if (isSuccess) {
    const mockPipeline = generateMockPipeline(id)
    // Apply updates to the mock pipeline
    if (updates.name) {
      mockPipeline.name = updates.name
    }

    return NextResponse.json({
      success: true,
      pipeline: mockPipeline,
    })
  } else {
    return NextResponse.json(
      {
        success: false,
        error: `Pipeline with id ${id} does not exist`,
      },
      { status: 404 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  const { id } = params

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Pipeline ID is required',
      },
      { status: 400 },
    )
  }

  // Simulate 90% success rate for realistic testing
  const isSuccess = Math.random() > 0.1

  if (isSuccess) {
    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} deleted successfully`,
    })
  } else {
    return NextResponse.json(
      {
        success: false,
        error: `Pipeline with id ${id} does not exist`,
      },
      { status: 404 },
    )
  }
}
