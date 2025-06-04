import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

// NOTE: added for debugging while testing locally and preparing for k8s deployment
console.log('API_URL', API_URL)
console.log('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL)

export interface PipelineResponse {
  pipeline_id: string
  status: 'running' | 'stopped' | 'error'
  error?: string
}

export interface PipelineError {
  code: number
  message: string
}

export const createPipeline = async (config: any): Promise<PipelineResponse> => {
  try {
    const response = await axios.post(`${API_URL}/pipeline`, config)
    return {
      pipeline_id: response.data.pipeline_id,
      status: 'running',
    }
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response

      if (status === 403) {
        throw {
          code: 403,
          message: data.message || 'Pipeline already running. Please shutdown existing pipeline first.',
        } as PipelineError
      }

      if (status === 422) {
        throw {
          code: 422,
          message: data.message || 'Invalid pipeline configuration',
        } as PipelineError
      }

      throw {
        code: status,
        message: data.message || 'Failed to create pipeline',
      } as PipelineError
    }
    throw {
      code: 500,
      message: 'Failed to create pipeline',
    } as PipelineError
  }
}

export const shutdownPipeline = async (): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/pipeline/shutdown`)
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response

      if (status === 404) {
        throw {
          code: 404,
          message: 'No active pipeline to shutdown',
        } as PipelineError
      }

      throw {
        code: status,
        message: data.message || 'Failed to shutdown pipeline',
      } as PipelineError
    }
    throw {
      code: 500,
      message: 'Failed to shutdown pipeline',
    } as PipelineError
  }
}

export const getPipelineStatus = async (): Promise<PipelineResponse> => {
  try {
    const response = await axios.get(`${API_URL}/pipeline`)
    if (response.data.id) {
      return {
        pipeline_id: response.data.id,
        status: 'running',
      }
    }
    throw {
      code: 404,
      message: 'No active pipeline',
    } as PipelineError
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response
      throw {
        code: status,
        message: data.message || 'Failed to get pipeline status',
      } as PipelineError
    }
    throw {
      code: 500,
      message: 'Failed to get pipeline status',
    } as PipelineError
  }
}
