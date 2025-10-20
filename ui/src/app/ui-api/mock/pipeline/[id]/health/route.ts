import { NextResponse } from 'next/server'
import { getPipelineStatus, getPipelineConfig } from '@/src/app/ui-api/mock/data/mock-state'

// Simple in-memory rate limiting (for development only)
const requestCounts = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 1000 // 1 second
const MAX_REQUESTS_PER_WINDOW = 10 // Max 10 requests per second per pipeline (increased for active testing)

/**
 * Mock pipeline health endpoint
 * GET /ui-api/mock/pipeline/[id]/health
 *
 * Returns the current health status of a pipeline using centralized state management.
 * This allows realistic simulation of pipeline lifecycle state changes.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Pipeline ID is required',
      },
      { status: 400 },
    )
  }

  // Simple rate limiting to prevent abuse
  const now = Date.now()
  const key = `health-${id}`
  const requestData = requestCounts.get(key)

  if (requestData) {
    if (now - requestData.lastReset > RATE_LIMIT_WINDOW) {
      // Reset window
      requestCounts.set(key, { count: 1, lastReset: now })
    } else if (requestData.count >= MAX_REQUESTS_PER_WINDOW) {
      // Rate limit exceeded
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded - too many health check requests',
        },
        { status: 429 },
      )
    } else {
      // Increment count
      requestData.count++
    }
  } else {
    // First request
    requestCounts.set(key, { count: 1, lastReset: now })
  }

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 50))

  // Get current status from centralized state
  const currentStatus = getPipelineStatus(id)
  const pipelineConfig = getPipelineConfig(id)

  // Generate health data with real-time status
  const healthData = {
    pipeline_id: id,
    pipeline_name: pipelineConfig?.name || `Mock Pipeline ${id}`,
    overall_status: currentStatus,
    created_at: pipelineConfig?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return NextResponse.json({
    success: true,
    health: healthData,
  })
}
