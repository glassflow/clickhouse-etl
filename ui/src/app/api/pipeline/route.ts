import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function POST(request: Request) {
  try {
    const config = await request.json()
    const response = await axios.post(`${API_URL}/pipeline`, config)

    return NextResponse.json({
      success: true,
      pipeline_id: response.data.pipeline_id,
      status: 'active',
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
          error: data.message || 'Failed to create pipeline - route',
        },
        { status },
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create pipeline - route - no error object',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const response = await axios.get(`${API_URL}/pipeline`)

    return NextResponse.json({
      success: true,
      pipelines: response.data,
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
          error: data.message || 'Failed to get pipelines',
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get pipelines',
      },
      { status: 500 },
    )
  }
}

// DELETE method is handled by /api/pipeline/[id]/route.ts for individual pipeline shutdown
// This route only handles GET (list all pipelines) and POST (create pipeline)
