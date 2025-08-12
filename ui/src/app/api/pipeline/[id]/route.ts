import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    console.log(`Pipeline API route - fetching pipeline ${id} from backend`)
    const response = await axios.get(`${API_URL}/pipeline/${id}`)

    console.log(`Pipeline API route - backend returned pipeline ${id}:`, JSON.stringify(response.data, null, 2))

    return NextResponse.json({
      success: true,
      pipeline: response.data,
    })
  } catch (error: any) {
    console.error('API Route - Error details:', {
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
          error: data.message || `Failed to fetch pipeline ${id}`,
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
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

    const response = await axios.patch(`${API_URL}/pipeline/${id}`, updates)

    return NextResponse.json({
      success: true,
      pipeline: response.data,
    })
  } catch (error: any) {
    console.error('API Route - Error details:', {
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
          error: data.message || `Failed to update pipeline ${id}`,
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to update pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}

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

    await axios.delete(`${API_URL}/pipeline/${id}`)

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} deleted successfully`,
    })
  } catch (error: any) {
    console.error('API Route - Error details:', {
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
          error: data.message || `Failed to delete pipeline ${id}`,
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to delete pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
