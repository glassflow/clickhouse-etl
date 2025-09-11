import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function GET() {
  // Check if we should use mock mode
  const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  if (useMockApi) {
    // Use mock platform info
    return NextResponse.json({
      orchestrator: 'docker',
      api_version: 'v1',
    })
  }

  try {
    const response = await axios.get(`${API_URL}/platform`, {
      timeout: 5000, // 5 second timeout
    })

    // Return the platform info directly from the backend
    return NextResponse.json(response.data)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          error: data?.message || `Failed to fetch platform info with status ${status}`,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        error: 'Backend is not responding',
      },
      { status: 503 },
    )
  }
}
