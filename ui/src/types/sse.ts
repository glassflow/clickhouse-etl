/**
 * Server-Sent Events (SSE) types for pipeline status streaming
 */

import { PipelineStatus } from './pipeline'

/**
 * SSE event types sent from server to client
 */
export type SSEEventType = 'status_update' | 'initial' | 'batch_update' | 'error' | 'heartbeat'

/**
 * Base SSE event structure
 */
export interface SSEBaseEvent {
  type: SSEEventType
  timestamp: number
}

/**
 * Single pipeline status update event
 */
export interface SSEStatusUpdateEvent extends SSEBaseEvent {
  type: 'status_update'
  pipelineId: string
  status: PipelineStatus
  previousStatus?: PipelineStatus
}

/**
 * Initial status event sent when connection is established
 */
export interface SSEInitialEvent extends SSEBaseEvent {
  type: 'initial'
  pipelineId: string
  status: PipelineStatus
}

/**
 * Batch update event for multiple pipelines at once
 */
export interface SSEBatchUpdateEvent extends SSEBaseEvent {
  type: 'batch_update'
  updates: Array<{
    pipelineId: string
    status: PipelineStatus
    previousStatus?: PipelineStatus
  }>
}

/**
 * Error event
 */
export interface SSEErrorEvent extends SSEBaseEvent {
  type: 'error'
  message: string
  pipelineId?: string
  code?: string
}

/**
 * Heartbeat event to keep connection alive
 */
export interface SSEHeartbeatEvent extends SSEBaseEvent {
  type: 'heartbeat'
}

/**
 * Union type for all SSE events
 */
export type SSEEvent =
  | SSEStatusUpdateEvent
  | SSEInitialEvent
  | SSEBatchUpdateEvent
  | SSEErrorEvent
  | SSEHeartbeatEvent

/**
 * SSE connection states
 */
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting'

/**
 * SSE subscription configuration
 */
export interface SSESubscription {
  pipelineIds: string[]
  onStatusChange?: (pipelineId: string, status: PipelineStatus, previousStatus?: PipelineStatus) => void
  onError?: (error: Error) => void
  onConnectionChange?: (state: SSEConnectionState) => void
}

/**
 * SSE manager configuration
 */
export interface SSEManagerConfig {
  /** Base URL for SSE endpoint (defaults to /ui-api/pipeline/status/stream) */
  endpoint?: string
  /** Maximum reconnection attempts before falling back to polling */
  maxReconnectAttempts?: number
  /** Initial reconnection delay in ms */
  reconnectDelay?: number
  /** Maximum reconnection delay in ms (for exponential backoff) */
  maxReconnectDelay?: number
  /** Heartbeat timeout in ms - if no heartbeat received, reconnect */
  heartbeatTimeout?: number
  /** Enable fallback to polling on SSE failure */
  enablePollingFallback?: boolean
}

/**
 * Default SSE manager configuration
 */
export const DEFAULT_SSE_CONFIG: Required<SSEManagerConfig> = {
  endpoint: '/ui-api/pipeline/status/stream',
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatTimeout: 45000, // Server sends heartbeat every 30s, so 45s timeout
  enablePollingFallback: true,
}
