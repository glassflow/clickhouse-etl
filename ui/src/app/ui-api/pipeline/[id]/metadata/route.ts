import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const body = await request.json()

    if (!id || id.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Pipeline ID is required',
        },
        { status: 400 },
      )
    }

    // Forward the request to the backend API
    await axios.patch(`${API_URL}/pipeline/${id}/metadata`, body)

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 },
    )
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data.message || `Failed to update pipeline metadata for ${id}`,
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to update pipeline metadata for ${id}`,
      },
      { status: 500 },
    )
  }
}
