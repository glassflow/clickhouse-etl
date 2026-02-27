/**
 * Centralized Pipeline State Manager
 *
 * Single source of truth for all pipeline status management.
 * Handles tracking decisions, state updates, and business logic.
 */

import { pipelineStatusManager } from './pipeline-status-manager'
import { PipelineStatus } from '@/src/types/pipeline'
import { structuredLogger } from '@/src/observability'

// Global state for pipeline statuses
const pipelineState = new Map<string, PipelineStatus>()
const stateListeners = new Set<(pipelineId: string, status: PipelineStatus) => void>()

export interface PipelineStateManager {
  // State management
  getPipelineStatus: (pipelineId: string) => PipelineStatus | null
  setPipelineStatus: (pipelineId: string, status: PipelineStatus) => void
  subscribeTo: (callback: (pipelineId: string, status: PipelineStatus) => void) => () => void

  // Operation reporting
  reportOperation: (pipelineId: string, operation: 'stop' | 'resume' | 'terminate' | 'delete' | 'deploy') => void
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
      pipelineState.set(pipelineId, status)

      // Notify all listeners
      stateListeners.forEach((listener) => {
        try {
          listener(pipelineId, status)
        } catch (error) {
          structuredLogger.error('PipelineStateManager listener error', { error: error instanceof Error ? error.message : String(error) })
        }
      })
    }
  }

  subscribeTo(callback: (pipelineId: string, status: PipelineStatus) => void): () => void {
    stateListeners.add(callback)
    return () => stateListeners.delete(callback)
  }

  // Operation reporting - This is where the business logic lives
  reportOperation(pipelineId: string, operation: 'stop' | 'resume' | 'terminate' | 'delete' | 'deploy'): void {
    // Business logic: Should we track this pipeline?
    const shouldTrack = this.shouldTrackOperation(operation)

    if (shouldTrack) {
      // Start centralized tracking with state updates
      pipelineStatusManager.trackPipeline(
        pipelineId,
        {
          onStatusChange: (newStatus, previousStatus) => {
            this.setPipelineStatus(pipelineId, newStatus)
          },
          onError: (error) => {
            structuredLogger.error('PipelineStateManager tracking error', { pipeline_id: pipelineId, error: error instanceof Error ? error.message : String(error) })
          },
          onTimeout: () => {
            structuredLogger.info('PipelineStateManager tracking timeout', { pipeline_id: pipelineId })
          },
          onDestroyed: () => {
            structuredLogger.info('PipelineStateManager tracking stopped', { pipeline_id: pipelineId })
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
    this.setPipelineStatus(pipelineId, status)
  }

  // Monitoring management
  startMonitoring(pipelineIds: string[]): void {
    // Add to monitored set
    pipelineIds.forEach((id) => this.monitoredPipelines.add(id))

    // Start general monitoring for all pipelines
    pipelineIds.forEach((pipelineId) => {
      pipelineStatusManager.trackPipeline(
        pipelineId,
        {
          onStatusChange: (newStatus, previousStatus) => {
            this.setPipelineStatus(pipelineId, newStatus)
          },
          onError: (error) => {
            structuredLogger.error('PipelineStateManager general monitoring error', { pipeline_id: pipelineId, error: error instanceof Error ? error.message : String(error) })
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
      this.monitoredPipelines.delete(pipelineId)
      pipelineStatusManager.stopTracking(pipelineId)
    } else {
      this.monitoredPipelines.clear()
      pipelineStatusManager.killAllTracking()
    }
  }

  cleanup(): void {
    this.stopMonitoring()
    pipelineState.clear()
    stateListeners.clear()
  }

  // Business logic methods
  private shouldTrackOperation(operation: string): boolean {
    // Business logic: Which operations need tracking?
    switch (operation) {
      case 'stop':
      case 'resume':
      case 'terminate':
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
      case 'stop':
        return 30 // Stop (graceful) can take time to process remaining messages
      case 'resume':
        return 10 // Resume should be relatively quick
      case 'terminate':
        return 15 // Terminate operations are immediate
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
