import axios from 'axios'
import { getRuntimeEnv } from '@/src/utils/common.client'
import { PipelineStatus } from '@/src/types/pipeline'
import { getApiUrl } from '@/src/utils/mock-api'

// Type declaration for runtime environment
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string
      NEXT_PUBLIC_IN_DOCKER?: string
      NEXT_PUBLIC_PREVIEW_MODE?: string
    }
  }
}

const runtimeEnv = getRuntimeEnv()
const API_URL = runtimeEnv.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://app:8080/api/v1'

export interface PipelineResponse {
  pipeline_id: string
  status: PipelineStatus
  error?: string
}

export interface PipelineError {
  code: number
  message: string
}

export interface Pipeline {
  id: string
  pipeline_id?: string // For backward compatibility
  name: string
  status: PipelineStatus
  created_at?: string
  updated_at?: string
}

/**
 * Check if a pipeline exists by ID
 */
export const checkPipelineExists = async (pipelineId: string): Promise<boolean> => {
  try {
    const url = getApiUrl(`pipeline/${pipelineId}`)
    const response = await axios.get(url, {
      timeout: 5000,
    })

    // If we get a successful response, the pipeline exists
    return response.status === 200
  } catch (error: any) {
    // If we get a 404, the pipeline doesn't exist
    if (error.response?.status === 404) {
      return false
    }

    // For other errors, we'll assume it doesn't exist to be safe
    console.warn('Error checking pipeline existence:', error.message)
    return false
  }
}

/**
 * Get pipeline status
 */
export const getPipelineStatus = async (): Promise<PipelineResponse> => {
  try {
    const url = getApiUrl('pipeline/status')
    const response = await axios.get(url, {
      timeout: 5000,
    })

    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      // No running pipeline
      return {
        pipeline_id: '',
        status: 'stopped' as PipelineStatus,
      }
    }

    throw {
      code: error.response?.status || 500,
      message: error.response?.data?.message || error.message || 'Failed to get pipeline status',
    } as PipelineError
  }
}

/**
 * Create a new pipeline
 */
export const createPipeline = async (pipelineData: { id: string; name: string; config: any }): Promise<Pipeline> => {
  try {
    const url = getApiUrl('pipeline')
    const response = await axios.post(url, pipelineData, {
      timeout: 10000,
    })

    return response.data
  } catch (error: any) {
    throw {
      code: error.response?.status || 500,
      message: error.response?.data?.message || error.message || 'Failed to create pipeline',
    } as PipelineError
  }
}

/**
 * Get a pipeline by ID
 */
export const getPipeline = async (pipelineId: string): Promise<Pipeline> => {
  try {
    const url = getApiUrl(`pipeline/${pipelineId}`)
    const response = await axios.get(url, {
      timeout: 5000,
    })

    return response.data
  } catch (error: any) {
    throw {
      code: error.response?.status || 500,
      message: error.response?.data?.message || error.message || 'Failed to get pipeline',
    } as PipelineError
  }
}

/**
 * Shutdown a pipeline
 */
export const shutdownPipeline = async (): Promise<void> => {
  try {
    const url = getApiUrl('pipeline')
    const response = await axios.delete(url, {
      timeout: 10000,
    })

    if (!response.data.success) {
      throw {
        code: response.status,
        message: response.data.error || 'Failed to shutdown pipeline',
      } as PipelineError
    }
  } catch (error: any) {
    if (error.code) {
      throw error
    }
    throw {
      code: error.response?.status || 500,
      message: error.response?.data?.message || error.message || 'Failed to shutdown pipeline',
    } as PipelineError
  }
}
