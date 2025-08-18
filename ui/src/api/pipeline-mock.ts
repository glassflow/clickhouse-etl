import { getApiUrl, isMockMode } from '@/src/utils/mock-api'
import { generateMockKafkaEvent, generateMockKafkaTopics } from '@/src/utils/mock-api'
import { PipelineStatus } from '@/src/types/pipeline'

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
    const url = getApiUrl('pipeline')
    const response = await fetch(url, {
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
        message: data.error || 'Failed to create pipeline',
      } as PipelineError
    }
  } catch (error: any) {
    if (error.code) {
      throw error
    }
    throw {
      code: 500,
      message: error.message || 'Failed to create pipeline',
    } as PipelineError
  }
}

export const shutdownPipeline = async (): Promise<void> => {
  try {
    const url = getApiUrl('pipeline')
    const response = await fetch(url, {
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
    const url = getApiUrl('pipeline')
    const response = await fetch(url)

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

// Mock-specific functions for enhanced mock data
export const getMockKafkaTopics = async (): Promise<string[]> => {
  if (!isMockMode()) {
    throw new Error('Mock function called in non-mock mode')
  }

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  return generateMockKafkaTopics()
}

export const getMockKafkaEvent = async (offset?: number): Promise<any> => {
  if (!isMockMode()) {
    throw new Error('Mock function called in non-mock mode')
  }

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  return generateMockKafkaEvent(offset)
}
