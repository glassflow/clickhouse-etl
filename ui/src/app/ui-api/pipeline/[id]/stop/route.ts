import { NextResponse } from 'next/server'
import axios from 'axios'
import { structuredLogger } from '@/src/observability'
import { runtimeConfig } from '../../../config'
import { validatePipelineIdOrError } from '../../validation'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Validate pipeline ID format before sending to backend
  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    // Call the backend stop endpoint
    await axios.post(`${API_URL}/pipeline/${id}/stop`, {
      timeout: 30000, // 30 seconds timeout for stop operation
    })

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} stopped successfully`,
    })
  } catch (error: any) {
    structuredLogger.error('Stop Pipeline API Route error', { error: error.message, response: error.response?.data, status: error.response?.status })

    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data?.message || `Failed to stop pipeline ${id}`,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to stop pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
