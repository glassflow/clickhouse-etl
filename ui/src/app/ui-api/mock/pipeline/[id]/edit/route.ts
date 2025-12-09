import { NextResponse } from 'next/server'
import {
  canEdit,
  getPipelineConfig,
  updatePipelineConfig,
  getPipelineStatus,
} from '@/src/app/ui-api/mock/data/mock-state'

// Helper function to validate filter expression in mock mode
async function validateFilterIfEnabled(
  filter: { enabled: boolean; expression: string } | undefined,
  topics: Array<{ schema?: { fields?: Array<{ name: string; type: string }> } }> | undefined,
): Promise<{ valid: boolean; error?: string }> {
  if (!filter?.enabled || !filter?.expression) {
    return { valid: true }
  }

  // Get fields from the first topic for validation
  const firstTopic = topics?.[0]
  if (!firstTopic?.schema?.fields) {
    return { valid: true }
  }

  // Basic validation checks
  const expression = filter.expression.trim()
  if (!expression) {
    return { valid: false, error: 'empty expression' }
  }

  // Check for balanced parentheses
  let parenCount = 0
  for (const char of expression) {
    if (char === '(') parenCount++
    if (char === ')') parenCount--
    if (parenCount < 0) {
      return { valid: false, error: 'unmatched parentheses' }
    }
  }
  if (parenCount !== 0) {
    return { valid: false, error: 'unmatched parentheses' }
  }

  return { valid: true }
}

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

    // Validate filter expression if enabled
    const filterValidation = await validateFilterIfEnabled(newConfig.filter, newConfig.source?.topics)
    if (!filterValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Filter validation error: ${filterValidation.error}`,
        },
        { status: 400 },
      )
    }

    // Merge the new configuration with existing pipeline
    // Keep the same ID and state, but update all other fields
    const updatedPipeline = {
      ...existingPipeline,
      ...newConfig,
      pipeline_id: id, // Ensure ID doesn't change
      state: existingPipeline.state, // Keep current state
      // Handle filter config - merge if provided in newConfig, otherwise keep existing
      filter:
        newConfig.filter !== undefined
          ? newConfig.filter
          : existingPipeline.filter || { enabled: false, expression: '' },
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
