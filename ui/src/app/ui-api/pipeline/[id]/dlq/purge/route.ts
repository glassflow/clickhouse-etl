import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../../config'
import { validatePipelineIdOrError } from '../../../validation'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Validate pipeline ID format before sending to backend
  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    const response = await axios.post(`${API_URL}/pipeline/${id}/dlq/purge`, {
      timeout: 30000,
    })

    // Backend returns null on success (200 OK with null body)
    // Return success response with null data
    return NextResponse.json(response.data, { status: response.status })
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response

      // Handle both JSON and plain text error responses
      // Backend returns:
      // - JSON errors (422, 404): { message: string, field?: { [key: string]: string } }
      // - Plain text errors (500): "Internal Server Error" (string)
      let errorMessage = `Failed to purge DLQ for pipeline ${id}`
      let errorFields: Record<string, string> | undefined

      if (typeof data === 'string') {
        // Handle plain text error responses (e.g., 500 Internal Server Error)
        errorMessage = data.trim() || errorMessage
      } else if (data && typeof data === 'object') {
        // Handle JSON error responses
        if (data.message) {
          errorMessage = data.message
        } else if (data.error) {
          errorMessage = data.error
        }
        // Preserve field information from backend error responses
        if (data.field && typeof data.field === 'object') {
          errorFields = data.field
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          ...(errorFields && { field: errorFields }),
        },
        { status },
      )
    }

    // Handle network errors (no response)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to purge DLQ for pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
