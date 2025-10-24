/**
 * Centralized Mock State Management
 *
 * Provides persistent state management for mock pipelines across API requests.
 * This allows us to simulate realistic pipeline lifecycle changes (stop, edit, resume)
 * without needing a real backend.
 */

import { mockPipelines } from './pipelines'

// Pipeline status types that match backend format (uppercase first letter)
export type MockPipelineStatus =
  | 'Created'
  | 'Running'
  | 'Paused'
  | 'Pausing'
  | 'Resuming'
  | 'Stopping'
  | 'Stopped'
  | 'Terminating'
  | 'Terminated'
  | 'Failed'

// Map old 'state' field to new status format
const stateToStatus: Record<string, MockPipelineStatus> = {
  active: 'Running',
  paused: 'Paused',
  stopped: 'Stopped',
  error: 'Failed',
}

// In-memory state store for pipeline statuses
// Maps pipeline_id -> current status
const pipelineStates = new Map<string, MockPipelineStatus>()

// In-memory store for pipeline configurations
// Maps pipeline_id -> full pipeline config
type PipelineConfig = (typeof mockPipelines)[0]
const pipelineConfigs = new Map<string, PipelineConfig>()

/**
 * Initialize state from mock data
 */
export const initializeMockState = () => {
  if (pipelineStates.size === 0) {
    console.log('[MockState] Initializing mock pipeline states...')
    mockPipelines.forEach((pipeline) => {
      const status = stateToStatus[pipeline.state] || 'Running'
      pipelineStates.set(pipeline.pipeline_id, status)
      pipelineConfigs.set(pipeline.pipeline_id, pipeline)
      console.log(`[MockState] Initialized ${pipeline.pipeline_id}: ${status}`)
    })
  }
}

/**
 * Get current status for a pipeline
 */
export const getPipelineStatus = (pipelineId: string): MockPipelineStatus => {
  initializeMockState()
  return pipelineStates.get(pipelineId) || 'Running'
}

/**
 * Set status for a pipeline
 */
export const setPipelineStatus = (pipelineId: string, status: MockPipelineStatus): void => {
  initializeMockState()
  console.log(`[MockState] Setting ${pipelineId} status: ${status}`)
  pipelineStates.set(pipelineId, status)
}

/**
 * Get pipeline configuration
 */
export const getPipelineConfig = (pipelineId: string): PipelineConfig | undefined => {
  initializeMockState()
  return pipelineConfigs.get(pipelineId)
}

/**
 * Update pipeline configuration
 */
export const updatePipelineConfig = (pipelineId: string, config: PipelineConfig): void => {
  initializeMockState()
  console.log(`[MockState] Updating ${pipelineId} configuration`)
  pipelineConfigs.set(pipelineId, config)
}

/**
 * Simulate transitional state changes with realistic delays
 * E.g., "Stopping" -> "Stopped" after 2 seconds
 */
export const simulateTransition = (
  pipelineId: string,
  fromStatus: MockPipelineStatus,
  toStatus: MockPipelineStatus,
  delayMs: number = 2000,
): void => {
  setPipelineStatus(pipelineId, fromStatus)
  setTimeout(() => {
    setPipelineStatus(pipelineId, toStatus)
    console.log(`[MockState] Transition complete: ${pipelineId} ${fromStatus} -> ${toStatus}`)
  }, delayMs)
}

/**
 * Validate if pipeline can be edited (must be stopped)
 */
export const canEdit = (pipelineId: string): { allowed: boolean; reason?: string } => {
  const status = getPipelineStatus(pipelineId)
  if (status === 'Stopped' || status === 'Terminated') {
    return { allowed: true }
  }
  return {
    allowed: false,
    reason: `Pipeline must be stopped before editing. Current status: ${status}`,
  }
}

/**
 * Validate if pipeline can be stopped
 */
export const canStop = (pipelineId: string): { allowed: boolean; reason?: string } => {
  const status = getPipelineStatus(pipelineId)
  if (status === 'Running' || status === 'Paused') {
    return { allowed: true }
  }
  if (status === 'Stopped' || status === 'Terminated') {
    return { allowed: false, reason: 'Pipeline is already stopped' }
  }
  return { allowed: false, reason: `Cannot stop pipeline in ${status} state` }
}

/**
 * Validate if pipeline can be resumed
 */
export const canResume = (pipelineId: string): { allowed: boolean; reason?: string } => {
  const status = getPipelineStatus(pipelineId)
  if (status === 'Stopped' || status === 'Paused') {
    return { allowed: true }
  }
  return { allowed: false, reason: `Cannot resume pipeline in ${status} state` }
}

/**
 * Validate if pipeline can be paused
 */
export const canPause = (pipelineId: string): { allowed: boolean; reason?: string } => {
  const status = getPipelineStatus(pipelineId)
  if (status === 'Running') {
    return { allowed: true }
  }
  return { allowed: false, reason: `Cannot pause pipeline in ${status} state` }
}

/**
 * Register a new pipeline in the state system
 * Used when creating pipelines dynamically
 */
export const registerPipeline = (
  pipelineId: string,
  config: PipelineConfig,
  initialStatus: MockPipelineStatus = 'Running',
): void => {
  console.log(`[MockState] Registering new pipeline: ${pipelineId} (${initialStatus})`)
  pipelineStates.set(pipelineId, initialStatus)
  pipelineConfigs.set(pipelineId, config)
}

/**
 * Unregister a pipeline from the state system
 * Used when deleting pipelines
 */
export const unregisterPipeline = (pipelineId: string): void => {
  console.log(`[MockState] Unregistering pipeline: ${pipelineId}`)
  pipelineStates.delete(pipelineId)
  pipelineConfigs.delete(pipelineId)
}

/**
 * Reset all state (useful for testing)
 */
export const resetMockState = (): void => {
  console.log('[MockState] Resetting all state...')
  pipelineStates.clear()
  pipelineConfigs.clear()
  initializeMockState()
}
