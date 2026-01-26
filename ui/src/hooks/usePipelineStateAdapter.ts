/**
 * Pipeline State Adapter Hook
 *
 * Adapter layer that provides a consistent interface for pipeline state management.
 * Uses SSE (Server-Sent Events) for real-time pipeline status updates.
 *
 * SSE provides:
 * - Real-time status updates via server-sent events
 * - Reduced network overhead compared to polling
 * - Automatic reconnection with exponential backoff
 * - Built-in fallback mechanism if connection fails repeatedly
 */

import { useMemo } from 'react'
import { PipelineStatus } from '@/src/types/pipeline'

// SSE-based hooks for real-time pipeline status updates
import {
  usePipelineStateSSE,
  useMultiplePipelineStateSSE,
  usePipelineMonitoringSSE,
  useSSEFallbackState,
  useSSEConnectionState,
} from './usePipelineStateSSE'

// Operations hook from polling module (used for optimistic updates)
import { usePipelineOperations as usePipelineOperationsPolling } from './usePipelineState'

/**
 * Hook for single pipeline status
 *
 * Returns the current status of a pipeline via SSE streaming.
 */
export function usePipelineState(pipelineId: string): PipelineStatus | null {
  return usePipelineStateSSE(pipelineId)
}

/**
 * Hook for multiple pipeline statuses
 *
 * Returns a record of pipeline IDs to their current statuses via SSE streaming.
 */
export function useMultiplePipelineState(
  pipelineIds: string[]
): Record<string, PipelineStatus | null> {
  // Memoize pipeline IDs to prevent unnecessary re-renders
  const memoizedIds = useMemo(() => pipelineIds, [JSON.stringify(pipelineIds)])
  return useMultiplePipelineStateSSE(memoizedIds)
}

/**
 * Hook for pipeline monitoring lifecycle
 *
 * Manages SSE subscriptions for the given pipeline IDs.
 * Automatically subscribes on mount and unsubscribes on unmount.
 */
export function usePipelineMonitoring(pipelineIds: string[]): void {
  // Memoize pipeline IDs to prevent unnecessary re-renders
  const memoizedIds = useMemo(() => pipelineIds, [JSON.stringify(pipelineIds)])
  usePipelineMonitoringSSE(memoizedIds)
}

/**
 * Re-export usePipelineOperations
 *
 * Operations (stop, resume, terminate, etc.) use the polling-based
 * state manager for optimistic updates. This ensures operations work
 * correctly even during SSE connection issues.
 */
export { usePipelineOperationsPolling as usePipelineOperations }

/**
 * Hook to get SSE connection information (for debugging/UI indicators)
 */
export function useTransportInfo(): {
  mode: 'sse'
  connectionState: ReturnType<typeof useSSEConnectionState>
  isFallbackActive: boolean
} {
  const connectionState = useSSEConnectionState()
  const { isFallbackActive } = useSSEFallbackState()

  return {
    mode: 'sse',
    connectionState,
    isFallbackActive,
  }
}
