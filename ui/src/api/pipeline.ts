import axios from 'axios'
import { getRuntimeEnv } from '@/src/utils/common.client'
import { PipelineStatus } from '@/src/types/pipeline'

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

export const createPipeline = async (config: any): Promise<PipelineResponse> => {
  try {
    const response = await fetch('/api/pipeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    const data = await response.json()

    if (data.success) {
      return {
        pipeline_id: data.pipeline_id,
        status: 'active',
      }
    } else {
      throw {
        code: response.status,
        message: data.error || 'Failed to create pipeline - client',
      } as PipelineError
    }
  } catch (error: any) {
    console.error('Client - Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })
    if (error.code) {
      throw error
    }
    throw {
      code: 500,
      message: error.message || 'Failed to create pipeline - client - exception',
    } as PipelineError
  }
}

export const shutdownPipeline = async (): Promise<void> => {
  try {
    const response = await fetch('/api/pipeline', {
      method: 'DELETE',
    })

    const data = await response.json()

    if (!data.success) {
      throw {
        code: response.status,
        message: data.error || 'Failed to shutdown pipeline',
      } as PipelineError
    }
  } catch (error: any) {
    if (error.code) {
      throw error
    }
    throw {
      code: 500,
      message: error.message || 'Failed to shutdown pipeline',
    } as PipelineError
  }
}

export const getPipelineStatus = async (): Promise<PipelineResponse> => {
  try {
    const response = await fetch('/api/pipeline')

    const data = await response.json()

    if (data.success) {
      return {
        pipeline_id: data.pipeline_id,
        status: 'active',
      }
    } else {
      throw {
        code: response.status,
        message: data.error || 'Failed to get pipeline status',
      } as PipelineError
    }
  } catch (error: any) {
    if (error.code) {
      throw error
    }
    throw {
      code: 500,
      message: error.message || 'Failed to get pipeline status',
    } as PipelineError
  }
}
