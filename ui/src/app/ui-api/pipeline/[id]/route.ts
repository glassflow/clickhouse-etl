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
    // Forward binding query params (topic, schema) to backend when present
    const { searchParams } = new URL(request.url)
    const topic = searchParams.get('topic')
    const schema = searchParams.get('schema')
    const queryString = [
      topic ? `topic=${encodeURIComponent(topic)}` : null,
      schema ? `schema=${encodeURIComponent(schema)}` : null,
    ]
      .filter(Boolean)
      .join('&')
    const url = queryString ? `${API_URL}/pipeline/${id}?${queryString}` : `${API_URL}/pipeline/${id}`
    const response = await axios.get(url)

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
