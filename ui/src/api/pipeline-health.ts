import { getApiUrl } from '@/src/utils/mock-api'

// Pipeline health status from backend
export type PipelineHealthStatus =
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

export interface PipelineHealth {
  pipeline_id: string
  pipeline_name: string
  overall_status: PipelineHealthStatus
  created_at: string
  updated_at: string
}

export interface PipelineHealthError {
  code: number
  message: string
}

/**
 * Get pipeline health status by ID
 */
export const getPipelineHealth = async (pipelineId: string): Promise<PipelineHealth> => {
  try {
    const url = getApiUrl(`pipeline/${pipelineId}/health`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw {
        code: response.status,
        message: errorData.error || `HTTP ${response.status}: Failed to fetch pipeline health`,
      } as PipelineHealthError
    }

    const data = await response.json()

    if (!data.success) {
      throw {
        code: 500,
        message: data.error || 'Failed to fetch pipeline health',
      } as PipelineHealthError
    }

    return data.health
  } catch (error: any) {
    // Handle network errors and timeouts
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw {
        code: 408,
        message: 'Request timeout - pipeline health check took too long',
      } as PipelineHealthError
    }

    // Re-throw structured errors
    if (error.code && error.message) {
      throw error
    }

    // Handle unexpected errors
    throw {
      code: 500,
      message: error.message || 'Unknown error occurred while fetching pipeline health',
    } as PipelineHealthError
  }
}

/**
 * Check if a pipeline health status indicates the pipeline is active
 */
export const isPipelineActive = (status: PipelineHealthStatus): boolean => {
  return status === 'Running' || status === 'Paused'
}

/**
 * Check if a pipeline health status indicates the pipeline is transitioning
 */
export const isPipelineTransitioning = (status: PipelineHealthStatus): boolean => {
  return (
    status === 'Created' ||
    status === 'Pausing' ||
    status === 'Resuming' ||
    status === 'Stopping' ||
    status === 'Terminating'
  )
}

/**
 * Check if a pipeline health status indicates the pipeline has failed
 */
export const isPipelineFailed = (status: PipelineHealthStatus): boolean => {
  return status === 'Failed'
}

/**
 * Check if a pipeline health status indicates the pipeline is terminated
 */
export const isPipelineTerminated = (status: PipelineHealthStatus): boolean => {
  return status === 'Terminated' || status === 'Stopped'
}

/**
 * Convert pipeline health status to UI-friendly display text
 */
export const getHealthStatusDisplayText = (status: PipelineHealthStatus): string => {
  switch (status) {
    case 'Created':
      return 'Starting...'
    case 'Running':
      return 'Running'
    case 'Paused':
      return 'Paused'
    case 'Pausing':
      return 'Pausing...'
    case 'Resuming':
      return 'Resuming...'
    case 'Stopping':
      return 'Stopping...'
    case 'Stopped':
      return 'Stopped'
    case 'Terminating':
      return 'Terminating...'
    case 'Terminated':
      return 'Terminated'
    case 'Failed':
      return 'Failed'
    default:
      return 'Unknown'
  }
}

/**
 * Get appropriate CSS classes for health status display
 */
export const getHealthStatusClasses = (status: PipelineHealthStatus): string => {
  switch (status) {
    case 'Created':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'Running':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'Paused':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'Pausing':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'Resuming':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'Stopping':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'Stopped':
      return 'text-gray-600 bg-gray-50 border-gray-200'
    case 'Terminating':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'Terminated':
      return 'text-gray-600 bg-gray-50 border-gray-200'
    case 'Failed':
      return 'text-red-600 bg-red-50 border-red-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}
