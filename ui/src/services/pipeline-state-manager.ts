/**
 * Centralized Pipeline State Manager
 *
 * Single source of truth for all pipeline status management.
 * Handles tracking decisions, state updates, and business logic.
 */

import { pipelineStatusManager } from './pipeline-status-manager'
import { PipelineStatus } from '@/src/types/pipeline'

// Global state for pipeline statuses
const pipelineState = new Map<string, PipelineStatus>()
const stateListeners = new Set<(pipelineId: string, status: PipelineStatus) => void>()

export interface PipelineStateManager {
  // State management
  getPipelineStatus: (pipelineId: string) => PipelineStatus | null
  setPipelineStatus: (pipelineId: string, status: PipelineStatus) => void
  subscribeTo: (callback: (pipelineId: string, status: PipelineStatus) => void) => () => void

  // Operation reporting
  reportOperation: (pipelineId: string, operation: 'pause' | 'resume' | 'stop' | 'delete' | 'deploy') => void
  reportOptimisticUpdate: (pipelineId: string, status: PipelineStatus) => void

  // Lifecycle
  startMonitoring: (pipelineIds: string[]) => void
  stopMonitoring: (pipelineId?: string) => void
  cleanup: () => void
}

class PipelineStateManagerImpl implements PipelineStateManager {
  private monitoredPipelines = new Set<string>()

  // State management
  getPipelineStatus(pipelineId: string): PipelineStatus | null {
    return pipelineState.get(pipelineId) || null
  }

  setPipelineStatus(pipelineId: string, status: PipelineStatus): void {
    const currentStatus = pipelineState.get(pipelineId)
    if (currentStatus !== status) {
      console.log(`[PipelineStateManager] Status update: ${pipelineId} ${currentStatus} → ${status}`)
      pipelineState.set(pipelineId, status)

      // Notify all listeners
      stateListeners.forEach((listener) => {
        try {
          listener(pipelineId, status)
        } catch (error) {
          console.error('[PipelineStateManager] Listener error:', error)
        }
      })
    }
  }

  subscribeTo(callback: (pipelineId: string, status: PipelineStatus) => void): () => void {
    stateListeners.add(callback)
    return () => stateListeners.delete(callback)
  }

  // Operation reporting - This is where the business logic lives
  reportOperation(pipelineId: string, operation: 'pause' | 'resume' | 'stop' | 'delete' | 'deploy'): void {
    console.log(`[PipelineStateManager] Operation reported: ${operation} on ${pipelineId}`)

    // Business logic: Should we track this pipeline?
    const shouldTrack = this.shouldTrackOperation(operation)

    if (shouldTrack) {
      console.log(`[PipelineStateManager] Starting tracking for ${pipelineId} (${operation})`)

      // Start centralized tracking with state updates
      pipelineStatusManager.trackPipeline(
        pipelineId,
        {
          onStatusChange: (newStatus, previousStatus) => {
            console.log(`[PipelineStateManager] Tracked status change: ${pipelineId} ${previousStatus} → ${newStatus}`)
            this.setPipelineStatus(pipelineId, newStatus)
          },
          onError: (error) => {
            console.error(`[PipelineStateManager] Tracking error for ${pipelineId}:`, error)
          },
          onTimeout: () => {
            console.log(`[PipelineStateManager] Tracking timeout for ${pipelineId}`)
          },
          onDestroyed: () => {
            console.log(`[PipelineStateManager] Tracking stopped for ${pipelineId}`)
          },
        },
        {
          operationName: operation,
          maxDurationMinutes: this.getMaxDurationForOperation(operation),
        },
      )
    }
  }

  reportOptimisticUpdate(pipelineId: string, status: PipelineStatus): void {
    console.log(`[PipelineStateManager] Optimistic update: ${pipelineId} → ${status}`)
    this.setPipelineStatus(pipelineId, status)
  }

  // Monitoring management
  startMonitoring(pipelineIds: string[]): void {
    console.log(`[PipelineStateManager] Starting general monitoring for ${pipelineIds.length} pipelines`)

    // Add to monitored set
    pipelineIds.forEach((id) => this.monitoredPipelines.add(id))

    // Start general monitoring for all pipelines
    pipelineIds.forEach((pipelineId) => {
      pipelineStatusManager.trackPipeline(
        pipelineId,
        {
          onStatusChange: (newStatus, previousStatus) => {
            console.log(`[PipelineStateManager] General monitoring: ${pipelineId} ${previousStatus} → ${newStatus}`)
            this.setPipelineStatus(pipelineId, newStatus)
          },
          onError: (error) => {
            console.error(`[PipelineStateManager] General monitoring error for ${pipelineId}:`, error)
          },
        },
        {
          operationName: 'general monitoring',
          maxDurationMinutes: 60,
        },
      )
    })
  }

  stopMonitoring(pipelineId?: string): void {
    if (pipelineId) {
      console.log(`[PipelineStateManager] Stopping monitoring for ${pipelineId}`)
      this.monitoredPipelines.delete(pipelineId)
      pipelineStatusManager.stopTracking(pipelineId)
    } else {
      console.log('[PipelineStateManager] Stopping all monitoring')
      this.monitoredPipelines.clear()
      pipelineStatusManager.killAllTracking()
    }
  }

  cleanup(): void {
    console.log('[PipelineStateManager] Cleaning up')
    this.stopMonitoring()
    pipelineState.clear()
    stateListeners.clear()
  }

  // Business logic methods
  private shouldTrackOperation(operation: string): boolean {
    // Business logic: Which operations need tracking?
    switch (operation) {
      case 'pause':
      case 'resume':
      case 'stop':
      case 'deploy':
        return true // These operations have transitions that need tracking
      case 'delete':
        return false // Delete is immediate, no tracking needed
      default:
        return false
    }
  }

  private getMaxDurationForOperation(operation: string): number {
    // Business logic: How long should we track each operation?
    switch (operation) {
      case 'pause':
        return 30 // Pause can take time to process remaining messages
      case 'resume':
        return 10 // Resume should be relatively quick
      case 'stop':
        return 15 // Stop operations typically complete faster than pause
      case 'deploy':
        return 20 // Deployments can take some time
      default:
        return 30
    }
  }
}

// Export singleton instance
export const pipelineStateManager = new PipelineStateManagerImpl()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pipelineStateManager.cleanup()
  })
}
