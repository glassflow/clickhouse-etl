import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'
import { validatePipelineIdOrError } from '../../validation'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Validate pipeline ID format before sending to backend
  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    const response = await axios.get(`${API_URL}/pipeline/${id}/health`, {
      timeout: 5000,
    })

    return NextResponse.json({
      success: true,
      health: response.data,
    })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: data.message || `Failed to fetch pipeline health for ${id}`,
        },
        { status },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch pipeline health for ${id}`,
      },
      { status: 500 },
    )
  }
}
