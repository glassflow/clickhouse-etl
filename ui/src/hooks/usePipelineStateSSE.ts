/**
 * React hooks for SSE-based pipeline state management
 *
 * These hooks mirror the interface of usePipelineState.ts but use
 * Server-Sent Events instead of polling for real-time updates.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { pipelineSSEManager } from '@/src/services/pipeline-sse-manager'
import { PipelineStatus } from '@/src/types/pipeline'
import { SSEConnectionState } from '@/src/types/sse'

/**
 * Hook to get status for a single pipeline via SSE
 */
export function usePipelineStateSSE(pipelineId: string): PipelineStatus | null {
  const [status, setStatus] = useState<PipelineStatus | null>(
    pipelineSSEManager.getPipelineStatus(pipelineId)
  )

  useEffect(() => {
    // Subscribe to status changes for this specific pipeline
    const unsubscribe = pipelineSSEManager.addStatusListener((id, newStatus) => {
      if (id === pipelineId) {
        setStatus(newStatus)
      }
    })

    // Get initial status from cache
    setStatus(pipelineSSEManager.getPipelineStatus(pipelineId))

    return unsubscribe
  }, [pipelineId])

  return status
}

/**
 * Hook to get status for multiple pipelines via SSE
 */
export function useMultiplePipelineStateSSE(
  pipelineIds: string[]
): Record<string, PipelineStatus | null> {
  const [statuses, setStatuses] = useState<Record<string, PipelineStatus | null>>(() => {
    const initial: Record<string, PipelineStatus | null> = {}
    pipelineIds.forEach((id) => {
      initial[id] = pipelineSSEManager.getPipelineStatus(id)
    })
    return initial
  })

  // Use ref to track current pipeline IDs to avoid stale closure issues
  const pipelineIdsRef = useRef(pipelineIds)
  pipelineIdsRef.current = pipelineIds

  useEffect(() => {
    // Subscribe to status changes for any of these pipelines
    const unsubscribe = pipelineSSEManager.addStatusListener((id, newStatus) => {
      if (pipelineIdsRef.current.includes(id)) {
        setStatuses((prev) => ({
          ...prev,
          [id]: newStatus,
        }))
      }
    })

    // Get initial statuses from cache
    const initial: Record<string, PipelineStatus | null> = {}
    pipelineIds.forEach((id) => {
      initial[id] = pipelineSSEManager.getPipelineStatus(id)
    })
    setStatuses(initial)

    return unsubscribe
  }, [pipelineIds])

  return statuses
}

/**
 * Hook for managing SSE pipeline monitoring lifecycle
 *
 * This hook subscribes to the SSE stream for the given pipeline IDs
 * and automatically unsubscribes when the component unmounts.
 */
export function usePipelineMonitoringSSE(pipelineIds: string[]): void {
  // Use ref to track if we've subscribed to avoid duplicate subscriptions
  const subscribedRef = useRef(false)
  const previousIdsRef = useRef<string[]>([])

  useEffect(() => {
    // Skip if no pipeline IDs
    if (pipelineIds.length === 0) return

    // Check if pipeline IDs have changed
    const idsChanged =
      pipelineIds.length !== previousIdsRef.current.length ||
      pipelineIds.some((id, index) => id !== previousIdsRef.current[index])

    if (idsChanged || !subscribedRef.current) {
      // Unsubscribe from previous IDs if they changed
      if (previousIdsRef.current.length > 0) {
        const removedIds = previousIdsRef.current.filter((id) => !pipelineIds.includes(id))
        if (removedIds.length > 0) {
          pipelineSSEManager.unsubscribe(removedIds)
        }
      }

      // Subscribe to new IDs
      pipelineSSEManager.subscribe(pipelineIds)
      subscribedRef.current = true
      previousIdsRef.current = [...pipelineIds]
    }

    return () => {
      // Unsubscribe when component unmounts
      if (subscribedRef.current && pipelineIds.length > 0) {
        pipelineSSEManager.unsubscribe(pipelineIds)
        subscribedRef.current = false
      }
    }
  }, [pipelineIds])
}

/**
 * Hook to get SSE connection state
 *
 * Useful for showing connection status indicators in the UI
 */
export function useSSEConnectionState(): SSEConnectionState {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>(
    pipelineSSEManager.getConnectionState()
  )

  useEffect(() => {
    const unsubscribe = pipelineSSEManager.addConnectionListener(setConnectionState)
    return unsubscribe
  }, [])

  return connectionState
}

/**
 * Hook to check if SSE has fallen back to polling
 */
export function useSSEFallbackState(): {
  isFallbackActive: boolean
  resetFallback: () => void
} {
  const [isFallbackActive, setIsFallbackActive] = useState(pipelineSSEManager.isFallbackActive())

  useEffect(() => {
    // Listen for fallback trigger event
    const handleFallback = () => {
      setIsFallbackActive(true)
    }

    window.addEventListener('sse-fallback-triggered', handleFallback)

    // Also check current state
    setIsFallbackActive(pipelineSSEManager.isFallbackActive())

    return () => {
      window.removeEventListener('sse-fallback-triggered', handleFallback)
    }
  }, [])

  const resetFallback = useCallback(() => {
    pipelineSSEManager.resetFallback()
    setIsFallbackActive(false)
    // Trigger reconnection
    pipelineSSEManager.reconnect()
  }, [])

  return { isFallbackActive, resetFallback }
}

/**
 * Combined hook that provides both status and connection info
 *
 * This is useful for components that need to show both pipeline status
 * and connection health indicators.
 */
export function usePipelineStateWithConnectionSSE(pipelineId: string): {
  status: PipelineStatus | null
  connectionState: SSEConnectionState
  isFallbackActive: boolean
} {
  const status = usePipelineStateSSE(pipelineId)
  const connectionState = useSSEConnectionState()
  const { isFallbackActive } = useSSEFallbackState()

  return {
    status,
    connectionState,
    isFallbackActive,
  }
}
