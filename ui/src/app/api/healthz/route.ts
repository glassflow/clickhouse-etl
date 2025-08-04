import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function GET() {
  try {
    const response = await axios.get(`${API_URL}/healthz`, {
      timeout: 5000, // 5 second timeout for health checks
    })

    // Backend returns simple 200 OK, so we just check if status is 200
    if (response.status === 200) {
      return NextResponse.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Backend is healthy',
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          message: `Backend health check failed with status ${response.status}`,
        },
        { status: response.status },
      )
    }
  } catch (error: any) {
    console.error('Health check API Route - Error details:', {
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
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          message: data?.message || `Backend health check failed with status ${status}`,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: 'Backend is not responding',
      },
      { status: 503 },
    )
  }
}
