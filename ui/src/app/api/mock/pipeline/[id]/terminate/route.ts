import { NextResponse } from 'next/server'

// Mock terminate pipeline endpoint
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Simulate network delay for realistic behavior
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock successful termination
    console.log(`[Mock] Terminating pipeline: ${id}`)

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} terminated successfully`,
    })
  } catch (error: any) {
    console.error('Mock Terminate Pipeline - Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: `Failed to terminate pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
