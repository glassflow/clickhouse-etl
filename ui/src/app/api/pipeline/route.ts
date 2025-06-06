import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

// Add debug logging
console.log('API Route - Final API_URL:', API_URL)

export async function POST(request: Request) {
  try {
    const config = await request.json()
    console.log('API Route - Request config:', config)
    console.log('API Route - Making request to:', `${API_URL}/pipeline`)

    const response = await axios.post(`${API_URL}/pipeline`, config)
    console.log('API Route - Response:', response.data)

    return NextResponse.json({
      success: true,
      pipeline_id: response.data.pipeline_id,
      status: 'running',
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

    if (response.data.id) {
      return NextResponse.json({
        success: true,
        pipeline_id: response.data.id,
        status: 'running',
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'No active pipeline',
      },
      { status: 404 },
    )
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Failed to get pipeline status',
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get pipeline status',
      },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    await axios.delete(`${API_URL}/pipeline/shutdown`)

    return NextResponse.json({
      success: true,
      message: 'Pipeline shutdown successful',
    })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response

      return NextResponse.json(
        {
          success: false,
          error: data.message || 'Failed to shutdown pipeline',
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to shutdown pipeline',
      },
      { status: 500 },
    )
  }
}
