/**
 * SSE (Server-Sent Events) API Route for Pipeline Status Streaming
 *
 * This endpoint streams real-time pipeline status updates to connected clients.
 * Instead of clients polling every 2s, the server polls the backend and broadcasts
 * changes to all connected clients.
 *
 * Usage: GET /ui-api/pipeline/status/stream?pipelineIds=id1,id2,id3
 */

import { NextRequest } from 'next/server'
import axios from 'axios'
import { runtimeConfig } from '../../../config'
import { PipelineStatus, parsePipelineStatus } from '@/src/types/pipeline'
import type {
  SSEStatusUpdateEvent,
  SSEInitialEvent,
  SSEBatchUpdateEvent,
  SSEErrorEvent,
  SSEHeartbeatEvent,
} from '@/src/types/sse'

// Get API URL from runtime config
const API_URL = runtimeConfig.apiUrl

// Configuration
const POLL_INTERVAL_MS = 2000 // Poll backend every 2 seconds
const HEARTBEAT_INTERVAL_MS = 30000 // Send heartbeat every 30 seconds
const REQUEST_TIMEOUT_MS = 3000 // Timeout for backend requests

// Track last known status per pipeline to only emit changes
const pipelineStatusCache = new Map<string, PipelineStatus>()

/**
 * Format an SSE event for transmission
 */
function formatSSEEvent(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * Fetch pipeline health status from backend
 */
async function fetchPipelineHealth(pipelineId: string): Promise<PipelineStatus | null> {
  try {
    const response = await axios.get(`${API_URL}/pipeline/${pipelineId}/health`, {
      timeout: REQUEST_TIMEOUT_MS,
    })

    if (response.data?.overall_status) {
      return parsePipelineStatus(response.data.overall_status)
    }

    return null
  } catch (error: any) {
    // Log error but don't throw - we'll handle missing pipelines gracefully
    if (error.response?.status === 404) {
      console.log(`[SSE] Pipeline ${pipelineId} not found`)
    } else {
      console.error(`[SSE] Error fetching health for pipeline ${pipelineId}:`, error.message)
    }
    return null
  }
}

/**
 * GET handler for SSE stream
 */
export async function GET(request: NextRequest) {
  // Parse pipeline IDs from query params
  const searchParams = request.nextUrl.searchParams
  const pipelineIdsParam = searchParams.get('pipelineIds')

  if (!pipelineIdsParam) {
    return new Response(JSON.stringify({ success: false, error: 'Missing pipelineIds parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const pipelineIds = pipelineIdsParam.split(',').filter((id) => id.trim().length > 0)

  if (pipelineIds.length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'No valid pipeline IDs provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder()
  let isStreamActive = true
  let pollIntervalId: NodeJS.Timeout | null = null
  let heartbeatIntervalId: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    async start(controller) {
      console.log(`[SSE] New connection for pipelines: ${pipelineIds.join(', ')}`)

      // Helper to send events. Never enqueue after stream is closed to avoid
      // Next.js/Node stream errors (e.g. controller[kState].transformAlgorithm).
      const sendEvent = (eventType: string, data: object) => {
        if (!isStreamActive) return
        try {
          controller.enqueue(encoder.encode(formatSSEEvent(eventType, data)))
        } catch (error: unknown) {
          isStreamActive = false
          // Expected when client disconnects: stream is closed and enqueue throws.
          // Don't log as error to avoid noise; Next.js may also surface transformAlgorithm errors.
          const msg = error instanceof Error ? error.message : String(error)
          if (/closed|invalid state|transformAlgorithm|already closed/i.test(msg)) {
            return
          }
          console.error('[SSE] Error sending event:', error)
        }
      }

      // Send initial status for all pipelines
      const initialStatuses: Array<{ pipelineId: string; status: PipelineStatus }> = []

      for (const pipelineId of pipelineIds) {
        const status = await fetchPipelineHealth(pipelineId)
        if (status) {
          pipelineStatusCache.set(pipelineId, status)
          initialStatuses.push({ pipelineId, status })
        }
      }

      // Send batch initial event
      if (initialStatuses.length > 0) {
        const batchEvent: SSEBatchUpdateEvent = {
          type: 'batch_update',
          timestamp: Date.now(),
          updates: initialStatuses.map(({ pipelineId, status }) => ({
            pipelineId,
            status,
          })),
        }
        sendEvent('batch_update', batchEvent)
      }

      // Start polling for status changes
      pollIntervalId = setInterval(async () => {
        if (!isStreamActive) {
          if (pollIntervalId) clearInterval(pollIntervalId)
          return
        }

        for (const pipelineId of pipelineIds) {
          if (!isStreamActive) break

          const newStatus = await fetchPipelineHealth(pipelineId)
          if (!newStatus) continue

          const previousStatus = pipelineStatusCache.get(pipelineId)

          // Only emit if status changed
          if (previousStatus !== newStatus) {
            pipelineStatusCache.set(pipelineId, newStatus)

            const updateEvent: SSEStatusUpdateEvent = {
              type: 'status_update',
              timestamp: Date.now(),
              pipelineId,
              status: newStatus,
              previousStatus,
            }
            sendEvent('status_update', updateEvent)
          }
        }
      }, POLL_INTERVAL_MS)

      // Start heartbeat to keep connection alive
      heartbeatIntervalId = setInterval(() => {
        if (!isStreamActive) {
          if (heartbeatIntervalId) clearInterval(heartbeatIntervalId)
          return
        }

        const heartbeatEvent: SSEHeartbeatEvent = {
          type: 'heartbeat',
          timestamp: Date.now(),
        }
        sendEvent('heartbeat', heartbeatEvent)
      }, HEARTBEAT_INTERVAL_MS)
    },

    cancel() {
      // Expected when client disconnects (navigation, tab close, EventSource close).
      // Clear intervals first so no callback runs after this and tries to enqueue.
      if (pollIntervalId) {
        clearInterval(pollIntervalId)
        pollIntervalId = null
      }
      if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId)
        heartbeatIntervalId = null
      }
      isStreamActive = false
      console.log('[SSE] Connection closed by client')
    },
  })

  // Return SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
