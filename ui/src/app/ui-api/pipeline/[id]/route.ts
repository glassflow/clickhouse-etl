import { NextResponse } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../config'
import { validatePipelineIdOrError } from '../validation'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Validate pipeline ID format before sending to backend
  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    const response = await axios.get(`${API_URL}/pipeline/${id}`)

    return NextResponse.json({
      success: true,
      pipeline: response.data,
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: (data as { message?: string })?.message || `Failed to fetch pipeline ${id}`,
        },
        { status },
      )
    }
    return NextResponse.json(
      { success: false, error: `Failed to fetch pipeline ${id}` },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Validate pipeline ID format before sending to backend
  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    const updates = await request.json()
    const response = await axios.patch(`${API_URL}/pipeline/${id}`, updates)

    return NextResponse.json({
      success: true,
      pipeline: response.data,
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: (data as { message?: string })?.message || `Failed to update pipeline ${id}`,
        },
        { status },
      )
    }
    return NextResponse.json(
      { success: false, error: `Failed to update pipeline ${id}` },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Validate pipeline ID format before sending to backend
  const validationError = validatePipelineIdOrError(id)
  if (validationError) return validationError

  try {
    await axios.delete(`${API_URL}/pipeline/${id}`)

    return NextResponse.json({
      success: true,
      message: `Pipeline ${id} deleted successfully`,
    })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response
      return NextResponse.json(
        {
          success: false,
          error: (data as { message?: string })?.message || `Failed to delete pipeline ${id}`,
        },
        { status },
      )
    }
    return NextResponse.json(
      { success: false, error: `Failed to delete pipeline ${id}` },
      { status: 500 },
    )
  }
}
