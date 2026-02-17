import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'

const API_URL = runtimeConfig.apiUrl

/**
 * POST /ui-api/transform/expression/evaluate
 * Proxies transformation expression evaluate requests to the Go backend
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const response = await axios.post(`${API_URL}/transform/expression/evaluate`, body)

    return NextResponse.json(response.data, { status: response.status })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(data, { status })
    }

    return NextResponse.json(
      {
        status: 500,
        code: 'internal_error',
        message: 'Failed to evaluate transformation expression',
        details: {
          error: error.message || 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}
