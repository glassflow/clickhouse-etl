import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

/**
 * POST /ui-api/filter/validate
 * Proxies filter expression validation requests to the Go backend
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const response = await axios.post(`${API_URL}/filter/validate`, body)

    // Backend returns empty body with 200 status on success
    return new NextResponse(null, { status: response.status })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(data, { status })
    }

    return NextResponse.json(
      {
        status: 500,
        code: 'internal_error',
        message: 'Failed to validate filter expression',
        details: {
          error: error.message || 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}
