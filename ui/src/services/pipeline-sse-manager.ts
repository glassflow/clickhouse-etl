/**
 * Pipeline SSE (Server-Sent Events) Manager
 *
 * Client-side singleton service that manages SSE connections for pipeline status updates.
 * Provides the same interface as the polling-based pipeline-state-manager for seamless switching.
 *
 * Features:
 * - Single EventSource connection per browser tab
 * - Automatic reconnection with exponential backoff
 * - Subscription management for multiple pipelines
 * - Falls back to polling on SSE failure
 * - Handles browser visibility changes
 */

import { PipelineStatus } from '@/src/types/pipeline'
import {
  SSEConnectionState,
  SSEEvent,
  SSEManagerConfig,
  DEFAULT_SSE_CONFIG,
  SSEStatusUpdateEvent,
  SSEBatchUpdateEvent,
  SSEHeartbeatEvent,
  SSEErrorEvent,
} from '@/src/types/sse'

// Callback types
type StatusChangeCallback = (pipelineId: string, status: PipelineStatus) => void
type ConnectionStateCallback = (state: SSEConnectionState) => void

/**
 * Pipeline SSE Manager - Singleton
 */
class PipelineSSEManagerImpl {
  private static instance: PipelineSSEManagerImpl | null = null

  // Configuration
  private config: Required<SSEManagerConfig>

  // EventSource connection
  private eventSource: EventSource | null = null
  private connectionState: SSEConnectionState = 'disconnected'

  // Subscriptions
  private subscribedPipelineIds = new Set<string>()
  private statusListeners = new Set<StatusChangeCallback>()
  private connectionListeners = new Set<ConnectionStateCallback>()

  // Status cache
  private pipelineStatusCache = new Map<string, PipelineStatus>()

  // Reconnection state
  private reconnectAttempts = 0
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null

  // Heartbeat monitoring
  private lastHeartbeat: number = 0
  private heartbeatCheckIntervalId: ReturnType<typeof setInterval> | null = null

  // Fallback flag
  private fallbackToPollingTriggered = false

  private constructor(config: SSEManagerConfig = {}) {
    this.config = { ...DEFAULT_SSE_CONFIG, ...config }
    this.setupVisibilityHandler()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: SSEManagerConfig): PipelineSSEManagerImpl {
    if (!PipelineSSEManagerImpl.instance) {
      PipelineSSEManagerImpl.instance = new PipelineSSEManagerImpl(config)
    }
    return PipelineSSEManagerImpl.instance
  }

  /**
   * Destroy singleton instance (for testing)
   */
  public static destroy(): void {
    if (PipelineSSEManagerImpl.instance) {
      PipelineSSEManagerImpl.instance.disconnect()
      PipelineSSEManagerImpl.instance = null
    }
  }

  // ============================================
  // Public API - Matches pipeline-state-manager interface
  // ============================================

  /**
   * Get current status for a pipeline
   */
  public getPipelineStatus(pipelineId: string): PipelineStatus | null {
    return this.pipelineStatusCache.get(pipelineId) || null
  }

  /**
   * Subscribe to status changes for specific pipelines
   */
  public subscribe(pipelineIds: string[]): void {
    const newIds = pipelineIds.filter((id) => !this.subscribedPipelineIds.has(id))

    if (newIds.length === 0) return

    // Add to subscribed set
    newIds.forEach((id) => this.subscribedPipelineIds.add(id))

    // Reconnect with updated pipeline IDs
    this.reconnect()
  }

  /**
   * Unsubscribe from specific pipelines
   */
  public unsubscribe(pipelineIds: string[]): void {
    let changed = false

    pipelineIds.forEach((id) => {
      if (this.subscribedPipelineIds.delete(id)) {
        changed = true
        this.pipelineStatusCache.delete(id)
      }
    })

    if (changed) {
      if (this.subscribedPipelineIds.size === 0) {
        // No more subscriptions, disconnect
        this.disconnect()
      } else {
        // Reconnect with updated pipeline IDs
        this.reconnect()
      }
    }
  }

  /**
   * Add a listener for status changes
   */
  public addStatusListener(callback: StatusChangeCallback): () => void {
    this.statusListeners.add(callback)
    return () => this.statusListeners.delete(callback)
  }

  /**
   * Add a listener for connection state changes
   */
  public addConnectionListener(callback: ConnectionStateCallback): () => void {
    this.connectionListeners.add(callback)
    // Immediately notify of current state
    callback(this.connectionState)
    return () => this.connectionListeners.delete(callback)
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): SSEConnectionState {
    return this.connectionState
  }

  /**
   * Check if fallback to polling has been triggered
   */
  public isFallbackActive(): boolean {
    return this.fallbackToPollingTriggered
  }

  /**
   * Reset fallback state (e.g., when user manually wants to try SSE again)
   */
  public resetFallback(): void {
    this.fallbackToPollingTriggered = false
    this.reconnectAttempts = 0
  }

  /**
   * Disconnect and cleanup
   */
  public disconnect(): void {
    this.clearReconnectTimeout()
    this.clearHeartbeatCheck()

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.setConnectionState('disconnected')
  }

  /**
   * Force reconnection
   */
  public reconnect(): void {
    this.disconnect()
    this.connect()
  }

  // ============================================
  // Private methods
  // ============================================

  /**
   * Establish SSE connection
   */
  private connect(): void {
    if (this.subscribedPipelineIds.size === 0) {
      console.log('[SSE Manager] No pipelines to subscribe to, skipping connection')
      return
    }

    if (this.fallbackToPollingTriggered) {
      console.log('[SSE Manager] Fallback to polling is active, skipping SSE connection')
      return
    }

    // Build URL with pipeline IDs
    const pipelineIds = Array.from(this.subscribedPipelineIds).join(',')
    const url = `${this.config.endpoint}?pipelineIds=${encodeURIComponent(pipelineIds)}`

    console.log(`[SSE Manager] Connecting to ${url}`)
    this.setConnectionState('connecting')

    try {
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = () => {
        console.log('[SSE Manager] Connection established')
        this.setConnectionState('connected')
        this.reconnectAttempts = 0
        this.lastHeartbeat = Date.now()
        this.startHeartbeatCheck()
      }

      // Listen for specific event types
      this.eventSource.addEventListener('status_update', (event) => {
        this.handleStatusUpdate(JSON.parse(event.data) as SSEStatusUpdateEvent)
      })

      this.eventSource.addEventListener('batch_update', (event) => {
        this.handleBatchUpdate(JSON.parse(event.data) as SSEBatchUpdateEvent)
      })

      this.eventSource.addEventListener('heartbeat', (event) => {
        this.handleHeartbeat(JSON.parse(event.data) as SSEHeartbeatEvent)
      })

      this.eventSource.addEventListener('error', (event) => {
        // Try to parse as SSE error event
        try {
          const data = JSON.parse((event as MessageEvent).data) as SSEErrorEvent
          console.error('[SSE Manager] Server error:', data.message)
        } catch {
          // Generic error handling below
        }
      })

      this.eventSource.onerror = (error) => {
        console.error('[SSE Manager] Connection error:', error)
        this.handleConnectionError()
      }
    } catch (error) {
      console.error('[SSE Manager] Failed to create EventSource:', error)
      this.handleConnectionError()
    }
  }

  /**
   * Handle status update event
   */
  private handleStatusUpdate(event: SSEStatusUpdateEvent): void {
    const { pipelineId, status, previousStatus } = event

    // Update cache
    this.pipelineStatusCache.set(pipelineId, status)

    // Notify listeners
    this.notifyStatusChange(pipelineId, status)

    console.log(`[SSE Manager] Status update: ${pipelineId} ${previousStatus} -> ${status}`)
  }

  /**
   * Handle batch update event (initial status)
   */
  private handleBatchUpdate(event: SSEBatchUpdateEvent): void {
    event.updates.forEach(({ pipelineId, status }) => {
      this.pipelineStatusCache.set(pipelineId, status)
      this.notifyStatusChange(pipelineId, status)
    })

    console.log(`[SSE Manager] Batch update: ${event.updates.length} pipelines`)
  }

  /**
   * Handle heartbeat event
   */
  private handleHeartbeat(event: SSEHeartbeatEvent): void {
    this.lastHeartbeat = event.timestamp
  }

  /**
   * Handle connection errors with reconnection logic
   */
  private handleConnectionError(): void {
    this.clearHeartbeatCheck()

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.reconnectAttempts++

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error(
        `[SSE Manager] Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`
      )
      this.setConnectionState('error')

      if (this.config.enablePollingFallback) {
        console.log('[SSE Manager] Triggering fallback to polling')
        this.fallbackToPollingTriggered = true
        this.notifyFallbackTriggered()
      }
      return
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    )

    console.log(
      `[SSE Manager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    )
    this.setConnectionState('reconnecting')

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect()
    }, delay)
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatCheck(): void {
    this.clearHeartbeatCheck()

    this.heartbeatCheckIntervalId = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat

      if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
        console.warn('[SSE Manager] Heartbeat timeout, reconnecting...')
        this.handleConnectionError()
      }
    }, this.config.heartbeatTimeout / 2)
  }

  /**
   * Clear heartbeat check interval
   */
  private clearHeartbeatCheck(): void {
    if (this.heartbeatCheckIntervalId) {
      clearInterval(this.heartbeatCheckIntervalId)
      this.heartbeatCheckIntervalId = null
    }
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: SSEConnectionState): void {
    if (this.connectionState === state) return

    this.connectionState = state
    this.connectionListeners.forEach((callback) => {
      try {
        callback(state)
      } catch (error) {
        console.error('[SSE Manager] Connection listener error:', error)
      }
    })
  }

  /**
   * Notify status change listeners
   */
  private notifyStatusChange(pipelineId: string, status: PipelineStatus): void {
    this.statusListeners.forEach((callback) => {
      try {
        callback(pipelineId, status)
      } catch (error) {
        console.error('[SSE Manager] Status listener error:', error)
      }
    })
  }

  /**
   * Notify that fallback to polling has been triggered
   * This is a special notification that the adapter hook can listen for
   */
  private notifyFallbackTriggered(): void {
    // Emit a special event that can be caught by the adapter
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sse-fallback-triggered'))
    }
  }

  /**
   * Setup visibility change handler to pause/resume connection
   */
  private setupVisibilityHandler(): void {
    if (typeof document === 'undefined') return

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab is hidden - disconnect to save resources
        console.log('[SSE Manager] Tab hidden, disconnecting')
        this.disconnect()
      } else {
        // Tab is visible again - reconnect if we have subscriptions
        if (this.subscribedPipelineIds.size > 0 && !this.fallbackToPollingTriggered) {
          console.log('[SSE Manager] Tab visible, reconnecting')
          this.connect()
        }
      }
    })
  }
}

// Export singleton instance
export const pipelineSSEManager = PipelineSSEManagerImpl.getInstance()

// Export class for testing
export { PipelineSSEManagerImpl }
