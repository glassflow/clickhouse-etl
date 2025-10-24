import { NextResponse } from 'next/server'
import {
  canEdit,
  getPipelineConfig,
  updatePipelineConfig,
  getPipelineStatus,
} from '@/src/app/ui-api/mock/data/mock-state'

/**
 * Mock edit pipeline endpoint
 * POST /ui-api/mock/pipeline/[id]/edit
 *
 * Updates a pipeline's configuration. Pipeline must be stopped.
 * Returns the updated pipeline config on success.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    if (!id || id.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Pipeline ID is required',
        },
        { status: 400 },
      )
    }

    // Get the existing pipeline config
    const existingPipeline = getPipelineConfig(id)
    if (!existingPipeline) {
      return NextResponse.json(
        {
          success: false,
          error: `Pipeline with id ${id} not found`,
        },
        { status: 404 },
      )
    }

    // Validate if pipeline can be edited (must be stopped)
    const validation = canEdit(id)
    if (!validation.allowed) {
      console.log(`[Mock] Edit rejected for ${id}: ${validation.reason}`)
      return NextResponse.json(
        {
          success: false,
          error: validation.reason || 'Pipeline must be stopped before editing',
        },
        { status: 400 },
      )
    }

    // Parse the request body (new configuration)
    const newConfig = await request.json()

    console.log(`[Mock] Editing pipeline: ${id}`)
    console.log(`[Mock] Current status: ${getPipelineStatus(id)}`)

    // Merge the new configuration with existing pipeline
    // Keep the same ID and state, but update all other fields
    const updatedPipeline = {
      ...existingPipeline,
      ...newConfig,
      pipeline_id: id, // Ensure ID doesn't change
      state: existingPipeline.state, // Keep current state
    }

    // Update the configuration in mock state
    updatePipelineConfig(id, updatedPipeline)

    // Simulate network delay for realistic behavior
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Return the updated pipeline (same format as backend)
    return NextResponse.json({
      success: true,
      pipeline: updatedPipeline,
    })
  } catch (error: any) {
    console.error('Mock Edit Pipeline - Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || `Failed to edit pipeline ${id}`,
      },
      { status: 500 },
    )
  }
}
