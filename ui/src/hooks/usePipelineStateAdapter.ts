/**
 * Pipeline State Adapter Hook
 *
 * Smart adapter that routes to either SSE-based or polling-based hooks
 * based on feature flag configuration. Provides seamless switching
 * without requiring UI component changes.
 *
 * Usage:
 * - Set NEXT_PUBLIC_USE_SSE_STATUS=true to enable SSE
 * - Set NEXT_PUBLIC_USE_SSE_STATUS=false (or omit) to use polling
 *
 * The adapter also handles automatic fallback from SSE to polling
 * if the SSE connection fails repeatedly.
 */

import { useState, useMemo, useEffect } from 'react'
import { PipelineStatus } from '@/src/types/pipeline'
import { isSSEStatusEnabled } from '@/src/config/feature-flags'

// Polling-based hooks (existing)
import {
  usePipelineState as usePipelineStatePolling,
  useMultiplePipelineState as useMultiplePipelineStatePolling,
  usePipelineOperations as usePipelineOperationsPolling,
  usePipelineMonitoring as usePipelineMonitoringPolling,
} from './usePipelineState'

// SSE-based hooks (new)
import {
  usePipelineStateSSE,
  useMultiplePipelineStateSSE,
  usePipelineMonitoringSSE,
  useSSEFallbackState,
} from './usePipelineStateSSE'

/**
 * Hook to determine which transport to use (SSE or polling)
 *
 * Returns 'sse' if SSE is enabled and not in fallback mode,
 * otherwise returns 'polling'.
 */
function useTransportMode(): 'sse' | 'polling' {
  const [sseEnabled] = useState(() => isSSEStatusEnabled())
  const { isFallbackActive } = useSSEFallbackState()

  // Use polling if SSE is disabled or fallback is active
  if (!sseEnabled || isFallbackActive) {
    return 'polling'
  }

  return 'sse'
}

/**
 * Adapter hook for single pipeline status
 *
 * Automatically routes to SSE or polling based on configuration.
 */
export function usePipelineState(pipelineId: string): PipelineStatus | null {
  const mode = useTransportMode()

  // Always call both hooks but only use the result from the active mode
  // This ensures hooks are called in consistent order (Rules of Hooks)
  const sseStatus = usePipelineStateSSE(pipelineId)
  const pollingStatus = usePipelineStatePolling(pipelineId)

  return mode === 'sse' ? sseStatus : pollingStatus
}

/**
 * Adapter hook for multiple pipeline statuses
 *
 * Automatically routes to SSE or polling based on configuration.
 */
export function useMultiplePipelineState(
  pipelineIds: string[]
): Record<string, PipelineStatus | null> {
  const mode = useTransportMode()

  // Memoize pipeline IDs to prevent unnecessary re-renders
  const memoizedIds = useMemo(() => pipelineIds, [JSON.stringify(pipelineIds)])

  // Always call both hooks but only use the result from the active mode
  const sseStatuses = useMultiplePipelineStateSSE(memoizedIds)
  const pollingStatuses = useMultiplePipelineStatePolling(memoizedIds)

  return mode === 'sse' ? sseStatuses : pollingStatuses
}

/**
 * Adapter hook for pipeline monitoring lifecycle
 *
 * Automatically routes to SSE or polling based on configuration.
 */
export function usePipelineMonitoring(pipelineIds: string[]): void {
  const mode = useTransportMode()

  // Memoize pipeline IDs to prevent unnecessary re-renders
  const memoizedIds = useMemo(() => pipelineIds, [JSON.stringify(pipelineIds)])

  // Call the appropriate monitoring hook based on mode
  // We need to conditionally call these, but since mode is stable
  // within a render, this is safe
  useEffect(() => {
    // The actual subscription is handled by the individual hooks below
  }, [mode])

  // Always call both to maintain hook order, but they'll handle
  // their own subscription logic internally
  usePipelineMonitoringSSE(mode === 'sse' ? memoizedIds : [])
  usePipelineMonitoringPolling(mode === 'polling' ? memoizedIds : [])
}

/**
 * Re-export usePipelineOperations unchanged
 *
 * Operations (stop, resume, terminate, etc.) always use the polling-based
 * state manager for optimistic updates, regardless of SSE/polling mode.
 * This ensures operations work correctly even during SSE connection issues.
 */
export { usePipelineOperationsPolling as usePipelineOperations }

/**
 * Hook to get current transport mode (for debugging/UI indicators)
 */
export function useTransportInfo(): {
  mode: 'sse' | 'polling'
  sseEnabled: boolean
  isFallbackActive: boolean
} {
  const [sseEnabled] = useState(() => isSSEStatusEnabled())
  const { isFallbackActive } = useSSEFallbackState()
  const mode = useTransportMode()

  return {
    mode,
    sseEnabled,
    isFallbackActive,
  }
}
