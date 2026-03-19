import { NextResponse } from 'next/server'
import axios from 'axios'
import { structuredLogger } from '@/src/observability'
import { runtimeConfig } from '../../../config'
import { validatePipelineIdOrError } from '../../validation'

const API_URL = runtimeConfig.apiUrl

/**
 * GET - Fetch pipeline resources
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    const response = await axios.get(`${API_URL}/pipeline/${id}/resources`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    structuredLogger.error('Get Pipeline Resources API Route error', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    })

    if (error.response) {
      const { status, data } = error.response
      const errorMessage =
        typeof data === 'string' ? data : data?.message || data?.error || 'Failed to fetch pipeline resources'

      return NextResponse.json({ error: errorMessage }, { status })
    }

    return NextResponse.json(
      { error: 'Failed to fetch pipeline resources' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update pipeline resources
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    const body = await request.json()
    const response = await axios.put(`${API_URL}/pipeline/${id}/resources`, body, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    structuredLogger.error('Update Pipeline Resources API Route error', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    })

    if (error.response) {
      const { status, data } = error.response
      const errorMessage =
        typeof data === 'string' ? data : data?.message || data?.error || 'Failed to update pipeline resources'

      return NextResponse.json({ error: errorMessage }, { status })
    }

    return NextResponse.json(
      { error: 'Failed to update pipeline resources' },
      { status: 500 }
    )
  }
}
