import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

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

    const backendUrl = `${API_URL}/pipeline/${id}/pause`

    // Call the backend pause endpoint
    const response = await axios.post(
      backendUrl,
      {},
      {
        timeout: 30000, // 30 seconds timeout for pause operation
      },
    )

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} paused successfully`,
    })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data?.message || `Failed to pause pipeline ${id}`,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to pause pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
