/**
 * Centralized Pipeline Status Manager
 *
 * Provides robust, framework-independent pipeline status tracking with:
 * - Progressive polling intervals for efficiency
 * - Multi-pipeline support with individual lifecycle management
 * - Backend synchronization to detect externally modified pipelines
 * - Global cleanup and kill switches
 * - Memory leak prevention
 * - Comprehensive error handling and retry logic
 * - Uses health endpoint for accurate pipeline status tracking
 */

import { getPipelines } from '@/src/api/pipeline-api'
import { getPipelineHealth } from '@/src/api/pipeline-health'
import { PipelineStatus, parsePipelineStatus } from '@/src/types/pipeline'
import { structuredLogger } from '@/src/observability'

// Types
export interface PipelineStatusCallbacks {
  onStatusChange?: (newStatus: PipelineStatus, previousStatus: PipelineStatus | null) => void
  onError?: (error: Error) => void
  onTimeout?: () => void
  onDestroyed?: () => void
}

export interface PipelineTrackingOptions {
  maxDurationMinutes?: number
  operationName?: string
  enableBackgroundSync?: boolean
}

interface PipelineTracker {
  pipelineId: string
  callbacks: PipelineStatusCallbacks
  options: PipelineTrackingOptions
  currentStatus: PipelineStatus | null
  elapsedTime: number
  timeoutId: ReturnType<typeof setTimeout> | null
  isActive: boolean
  errorCount: number
  lastErrorTime: number
  operationName: string
}

export interface ManagerStats {
  activeTrackers: number
  totalPollingOperations: number
  backendSyncEnabled: boolean
  lastBackendSync: Date | null
  orphanedPipelinesDetected: number
}

/**
 * Singleton Pipeline Status Manager
 * Handles all pipeline status tracking across the application
 */
export class PipelineStatusManager {
  private static instance: PipelineStatusManager | null = null
  private trackers = new Map<string, PipelineTracker>()
  private backendSyncInterval: ReturnType<typeof setInterval> | null = null
  private stats: ManagerStats = {
    activeTrackers: 0,
    totalPollingOperations: 0,
    backendSyncEnabled: true,
    lastBackendSync: null,
    orphanedPipelinesDetected: 0,
  }

  // Configuration
  private readonly MAX_ERROR_COUNT = 5
  private readonly ERROR_BACKOFF_TIME = 30000 // 30 seconds
  private readonly BACKEND_SYNC_INTERVAL = 30000 // 30 seconds
  private readonly DEFAULT_MAX_DURATION = 30 // 30 minutes

  private constructor() {
    this.startBackendSyncMonitor()
    this.setupGlobalCleanup()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PipelineStatusManager {
    if (!PipelineStatusManager.instance) {
      PipelineStatusManager.instance = new PipelineStatusManager()
    }
    return PipelineStatusManager.instance
  }

  /**
   * Start tracking a pipeline's status with progressive polling
   */
  public trackPipeline(
    pipelineId: string,
    callbacks: PipelineStatusCallbacks,
    options: PipelineTrackingOptions = {},
  ): void {
    // Stop any existing tracking for this pipeline
    this.stopTracking(pipelineId)

    const tracker: PipelineTracker = {
      pipelineId,
      callbacks,
      options: {
        maxDurationMinutes: this.DEFAULT_MAX_DURATION,
        operationName: 'status check',
        enableBackgroundSync: true,
        ...options,
      },
      currentStatus: null,
      elapsedTime: 0,
      timeoutId: null,
      isActive: true,
      errorCount: 0,
      lastErrorTime: 0,
      operationName: options.operationName || 'status check',
    }

    this.trackers.set(pipelineId, tracker)
    this.stats.activeTrackers = this.trackers.size

    // Start polling immediately
    this.scheduleNextCheck(tracker)
  }

  /**
   * Stop tracking a specific pipeline
   */
  public stopTracking(pipelineId: string): boolean {
    const tracker = this.trackers.get(pipelineId)
    if (!tracker) {
      return false
    }

    this.destroyTracker(tracker)
    this.trackers.delete(pipelineId)
    this.stats.activeTrackers = this.trackers.size

    return true
  }

  /**
   * Kill all active tracking operations
   */
  public killAllTracking(): void {
    this.trackers.forEach((tracker) => {
      this.destroyTracker(tracker)
    })

    this.trackers.clear()
    this.stats.activeTrackers = 0
  }

  /**
   * Get current tracking status for a pipeline
   */
  public getTrackingStatus(pipelineId: string): {
    isTracking: boolean
    currentStatus: PipelineStatus | null
    elapsedTime: number
    operationName: string
  } | null {
    const tracker = this.trackers.get(pipelineId)
    if (!tracker) {
      return null
    }

    return {
      isTracking: tracker.isActive,
      currentStatus: tracker.currentStatus,
      elapsedTime: tracker.elapsedTime,
      operationName: tracker.operationName,
    }
  }

  /**
   * Get manager statistics
   */
  public getStats(): ManagerStats {
    return { ...this.stats }
  }

  /**
   * Enable/disable backend synchronization
   */
  public setBackendSyncEnabled(enabled: boolean): void {
    this.stats.backendSyncEnabled = enabled
    if (enabled && !this.backendSyncInterval) {
      this.startBackendSyncMonitor()
    } else if (!enabled && this.backendSyncInterval) {
      clearInterval(this.backendSyncInterval)
      this.backendSyncInterval = null
    }
  }

  /**
   * Manually trigger backend synchronization
   */
  public async syncWithBackend(): Promise<void> {
    await this.detectOrphanedPipelines()
  }

  /**
   * Destroy the manager instance (for testing or cleanup)
   */
  public static destroy(): void {
    if (PipelineStatusManager.instance) {
      PipelineStatusManager.instance.killAllTracking()
      if (PipelineStatusManager.instance.backendSyncInterval) {
        clearInterval(PipelineStatusManager.instance.backendSyncInterval)
      }
      PipelineStatusManager.instance = null
    }
  }

  // Private methods

  private scheduleNextCheck(tracker: PipelineTracker): void {
    if (!tracker.isActive) {
      return
    }

    const nextInterval = this.getNextInterval(tracker.elapsedTime)
    const maxDuration = (tracker.options.maxDurationMinutes || this.DEFAULT_MAX_DURATION) * 60 * 1000

    tracker.timeoutId = setTimeout(async () => {
      if (!tracker.isActive) {
        return
      }

      tracker.elapsedTime += nextInterval

      // Check for timeout
      if (tracker.elapsedTime >= maxDuration) {
        tracker.callbacks.onTimeout?.()
        this.stopTracking(tracker.pipelineId)
        return
      }

      // Check for error backoff
      const now = Date.now()
      if (tracker.errorCount >= this.MAX_ERROR_COUNT && now - tracker.lastErrorTime < this.ERROR_BACKOFF_TIME) {
        this.scheduleNextCheck(tracker)
        return
      }

      // Perform status check
      await this.performStatusCheck(tracker)

      // Schedule next check if still active
      if (tracker.isActive) {
        this.scheduleNextCheck(tracker)
      }
    }, nextInterval)

    const minutes = Math.floor(tracker.elapsedTime / 60000)
    const seconds = Math.floor((tracker.elapsedTime % 60000) / 1000)
    const nextCheckSeconds = nextInterval / 1000
  }

  private async performStatusCheck(tracker: PipelineTracker): Promise<void> {
    this.stats.totalPollingOperations++

    try {
      // Use health endpoint to get pipeline status
      const health = await getPipelineHealth(tracker.pipelineId)
      // Parse backend health status (e.g., 'Running', 'Paused') to UI status (e.g., 'active', 'paused')
      const newStatus = parsePipelineStatus(health.overall_status)
      const previousStatus = tracker.currentStatus

      // Update tracker state
      tracker.currentStatus = newStatus
      tracker.errorCount = 0 // Reset error count on successful check

      // Notify callback if status changed
      if (previousStatus !== newStatus) {
        tracker.callbacks.onStatusChange?.(newStatus, previousStatus)
      }

      // Check if we should stop polling based on final states
      if (this.isFinalStatus(newStatus)) {
        this.stopTracking(tracker.pipelineId)
      }
    } catch (error) {
      tracker.errorCount++
      tracker.lastErrorTime = Date.now()

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      structuredLogger.error('PipelineStatusManager status check failed', { pipeline_id: tracker.pipelineId, attempt: tracker.errorCount, max_attempts: this.MAX_ERROR_COUNT, error: errorMessage })

      tracker.callbacks.onError?.(error instanceof Error ? error : new Error(errorMessage))

      // Stop tracking if max errors reached
      if (tracker.errorCount >= this.MAX_ERROR_COUNT) {
        structuredLogger.error('PipelineStatusManager max errors reached, stopping tracking', { pipeline_id: tracker.pipelineId })
        this.stopTracking(tracker.pipelineId)
      }
    }
  }

  private getNextInterval(elapsed: number): number {
    // Progressive intervals based on elapsed time
    if (elapsed < 60000) {
      return 2000 // First minute: every 2 seconds
    } else if (elapsed < 120000) {
      return 5000 // Second minute: every 5 seconds
    } else if (elapsed < 180000) {
      return 10000 // Third minute: every 10 seconds
    } else if (elapsed < 240000) {
      return 15000 // Fourth minute: every 15 seconds
    } else {
      return 30000 // Minutes 5+: every 30 seconds
    }
  }

  private isFinalStatus(status: PipelineStatus): boolean {
    // Statuses that don't require further polling
    return ['stopped', 'failed'].includes(status)
  }

  private destroyTracker(tracker: PipelineTracker): void {
    tracker.isActive = false

    if (tracker.timeoutId) {
      clearTimeout(tracker.timeoutId)
      tracker.timeoutId = null
    }

    tracker.callbacks.onDestroyed?.()
  }

  private startBackendSyncMonitor(): void {
    if (this.backendSyncInterval) {
      clearInterval(this.backendSyncInterval)
    }

    this.backendSyncInterval = setInterval(() => {
      if (this.stats.backendSyncEnabled && this.trackers.size > 0) {
        this.detectOrphanedPipelines().catch((error) => {
          structuredLogger.error('PipelineStatusManager backend sync failed', { error: error instanceof Error ? error.message : String(error) })
        })
      }
    }, this.BACKEND_SYNC_INTERVAL)
  }

  private async detectOrphanedPipelines(): Promise<void> {
    try {
      const trackedIds = Array.from(this.trackers.keys())
      if (trackedIds.length === 0) {
        return
      }

      const existingPipelines = await getPipelines()
      const existingIds = existingPipelines.map((p) => p.pipeline_id)

      const orphaned = trackedIds.filter((id) => !existingIds.includes(id))

      if (orphaned.length > 0) {
        structuredLogger.warn('PipelineStatusManager detected orphaned pipelines', { count: orphaned.length, pipeline_ids: orphaned.join(', ') })

        orphaned.forEach((pipelineId) => {
          const tracker = this.trackers.get(pipelineId)
          if (tracker) {
            tracker.callbacks.onError?.(new Error(`Pipeline ${pipelineId} no longer exists in backend`))
            this.stopTracking(pipelineId)
          }
        })

        this.stats.orphanedPipelinesDetected += orphaned.length
      }

      this.stats.lastBackendSync = new Date()
    } catch (error) {
      structuredLogger.error('PipelineStatusManager failed to detect orphaned pipelines', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  private setupGlobalCleanup(): void {
    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.killAllTracking()
      })

      // Cleanup on page visibility change (when tab becomes hidden)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.trackers.size > 0) {
          // Could implement reduced polling frequency here if needed
        }
      })
    }
  }
}

// Export singleton instance
export const pipelineStatusManager = PipelineStatusManager.getInstance()
