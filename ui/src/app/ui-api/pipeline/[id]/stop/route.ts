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

    // Call the backend stop endpoint
    await axios.post(`${API_URL}/pipeline/${id}/stop`, {
      timeout: 30000, // 30 seconds timeout for stop operation
    })

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} stopped successfully`,
    })
  } catch (error: any) {
    console.error('Stop Pipeline API Route - Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config,
    })

    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data?.message || `Failed to stop pipeline ${id}`,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to stop pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
