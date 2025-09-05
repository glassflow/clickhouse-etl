import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const batchSize = searchParams.get('batch_size')

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

    if (!batchSize) {
      return NextResponse.json(
        {
          success: false,
          error: 'batch_size query parameter is required',
        },
        { status: 400 },
      )
    }

    const response = await axios.get(`${API_URL}/pipeline/${id}/dlq/consume?batch_size=${batchSize}`, {
      timeout: 10000,
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    console.error('DLQ Consume API Route - Error details:', {
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
          error: data?.message || `Failed to consume DLQ messages for pipeline ${id}`,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to consume DLQ messages for pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
