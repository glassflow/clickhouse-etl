import { NextResponse } from 'next/server'
import axios from 'axios'
import { structuredLogger } from '@/src/observability'
import { runtimeConfig } from '../../../../config'
import { validatePipelineIdOrError } from '../../../validation'

const API_URL = runtimeConfig.apiUrl

/**
 * GET - Fetch pipeline resources validation rules (field immutability policy)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    const response = await axios.get(`${API_URL}/pipeline/${id}/resources/validation`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    structuredLogger.error('Get Pipeline Resources Validation API Route error', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    })

    if (error.response) {
      const { status, data } = error.response
      const errorMessage =
        typeof data === 'string' ? data : data?.message || data?.error || 'Failed to fetch pipeline resources validation'

      return NextResponse.json({ error: errorMessage }, { status })
    }

    return NextResponse.json(
      { error: 'Failed to fetch pipeline resources validation' },
      { status: 500 }
    )
  }
}
