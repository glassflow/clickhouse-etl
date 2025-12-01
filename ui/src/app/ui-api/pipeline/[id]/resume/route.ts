import { NextResponse } from 'next/server'
import axios from 'axios'
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
    const backendUrl = `${API_URL}/pipeline/${id}/resume`

    // Call the backend resume endpoint
    const response = await axios.post(
      backendUrl,
      {},
      {
        timeout: 30000, // 30 seconds timeout for resume operation
      },
    )

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} resumed successfully`,
    })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response

      return NextResponse.json(
        {
          success: false,
          error: data?.message || `Failed to resume pipeline ${id}`,
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to resume pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
