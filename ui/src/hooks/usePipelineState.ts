/**
 * React hook for consuming centralized pipeline state
 */

import { useEffect, useState } from 'react'
import { pipelineStateManager } from '@/src/services/pipeline-state-manager'
import { PipelineStatus } from '@/src/types/pipeline'

/**
 * Hook to get status for a single pipeline
 */
export function usePipelineState(pipelineId: string): PipelineStatus | null {
  const [status, setStatus] = useState<PipelineStatus | null>(pipelineStateManager.getPipelineStatus(pipelineId))

  useEffect(() => {
    // Subscribe to status changes for this specific pipeline
    const unsubscribe = pipelineStateManager.subscribeTo((id, newStatus) => {
      if (id === pipelineId) {
        setStatus(newStatus)
      }
    })

    // Get initial status
    setStatus(pipelineStateManager.getPipelineStatus(pipelineId))

    return unsubscribe
  }, [pipelineId])

  return status
}

/**
 * Hook to get status for multiple pipelines
 */
export function useMultiplePipelineState(pipelineIds: string[]): Record<string, PipelineStatus | null> {
  const [statuses, setStatuses] = useState<Record<string, PipelineStatus | null>>(() => {
    const initial: Record<string, PipelineStatus | null> = {}
    pipelineIds.forEach((id) => {
      initial[id] = pipelineStateManager.getPipelineStatus(id)
    })
    return initial
  })

  useEffect(() => {
    // Subscribe to status changes for any of these pipelines
    const unsubscribe = pipelineStateManager.subscribeTo((id, newStatus) => {
      if (pipelineIds.includes(id)) {
        setStatuses((prev) => ({
          ...prev,
          [id]: newStatus,
        }))
      }
    })

    // Get initial statuses
    const initial: Record<string, PipelineStatus | null> = {}
    pipelineIds.forEach((id) => {
      initial[id] = pipelineStateManager.getPipelineStatus(id)
    })
    setStatuses(initial)

    return unsubscribe
  }, [pipelineIds])

  return statuses
}

/**
 * Hook for pipeline operations - provides clean interface to report operations
 */
export function usePipelineOperations() {
  return {
    // Report operations to central system
    reportStop: (pipelineId: string) => {
      pipelineStateManager.reportOptimisticUpdate(pipelineId, 'stopping')
      pipelineStateManager.reportOperation(pipelineId, 'stop')
    },

    reportResume: (pipelineId: string) => {
      pipelineStateManager.reportOptimisticUpdate(pipelineId, 'resuming')
      pipelineStateManager.reportOperation(pipelineId, 'resume')
    },

    reportTerminate: (pipelineId: string) => {
      pipelineStateManager.reportOptimisticUpdate(pipelineId, 'terminating')
      pipelineStateManager.reportOperation(pipelineId, 'terminate')
    },

    reportDeploy: (pipelineId: string) => {
      pipelineStateManager.reportOptimisticUpdate(pipelineId, 'active') // Or 'deploying' if you add that status
      pipelineStateManager.reportOperation(pipelineId, 'deploy')
    },

    reportDelete: (pipelineId: string) => {
      pipelineStateManager.reportOptimisticUpdate(pipelineId, 'stopped')
      // Delete doesn't need tracking, it's immediate
    },

    // For error cases - revert optimistic updates
    revertOptimisticUpdate: (pipelineId: string, originalStatus: PipelineStatus) => {
      pipelineStateManager.reportOptimisticUpdate(pipelineId, originalStatus)
    },
  }
}

/**
 * Hook for managing pipeline monitoring lifecycle
 */
export function usePipelineMonitoring(pipelineIds: string[]) {
  useEffect(() => {
    // Start monitoring when component mounts
    pipelineStateManager.startMonitoring(pipelineIds)

    return () => {
      // Stop monitoring for these specific pipelines when component unmounts
      pipelineIds.forEach((id) => {
        pipelineStateManager.stopMonitoring(id)
      })
    }
  }, [pipelineIds])
}
