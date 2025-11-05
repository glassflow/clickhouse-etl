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

    // Get the pipeline configuration from request body
    const config = await request.json()

    // Call the backend edit endpoint
    const response = await axios.post(`${API_URL}/pipeline/${id}/edit`, config, {
      timeout: 60000, // 60 seconds timeout for edit operation (might need to stop/update/restart)
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} edited successfully`,
      pipeline: response.data,
    })
  } catch (error: any) {
    console.error('Edit Pipeline API Route - Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    })

    if (error.response) {
      const { status, data } = error.response

      // Handle both JSON and plain text error responses
      let errorMessage = `Failed to edit pipeline ${id}`
      if (typeof data === 'string') {
        errorMessage = data.trim() || errorMessage
      } else if (data?.message) {
        errorMessage = data.message
      } else if (data?.error) {
        errorMessage = data.error
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to edit pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
