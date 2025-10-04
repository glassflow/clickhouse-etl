import { NextResponse } from 'next/server'

// Simple in-memory rate limiting (for development only)
const requestCounts = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 1000 // 1 second
const MAX_REQUESTS_PER_WINDOW = 3 // Max 3 requests per second per pipeline

// Mock pipeline health data for development
const mockHealthData = {
  pipeline_id: 'mock-pipeline',
  pipeline_name: 'Mock Pipeline',
  overall_status: 'Running' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

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
  await new Promise((resolve) => setTimeout(resolve, 50)) // Reduced from 200ms to 50ms

  // Generate mock health data with the provided pipeline ID
  // Use a consistent status based on the pipeline ID to avoid constant polling loops
  // These statuses match what the real backend returns (uppercase first letter)
  const statuses = [
    'Created',
    'Running',
    'Paused',
    'Pausing',
    'Resuming',
    'Stopping',
    'Stopped',
    'Terminating',
    'Terminated',
    'Failed',
  ]
  const statusIndex = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % statuses.length
  const consistentStatus = statuses[statusIndex]

  const healthData = {
    ...mockHealthData,
    pipeline_id: id,
    pipeline_name: `Mock Pipeline ${id}`,
    overall_status: consistentStatus,
  }

  // Removed debug logging

  return NextResponse.json({
    success: true,
    health: healthData,
  })
}
