import { getApiUrl, isMockMode } from '@/src/utils/mock-api'
import type {
  Pipeline,
  ListPipelineConfig,
  Schema,
  Connection,
  DLQState,
  DLQEvent,
  ApiResponse,
  ApiError,
} from '@/src/types/pipeline'
import { getPipelineStatusFromState, detectTransformationType } from '@/src/types/pipeline'

// Pipeline API functions
export const getPipelines = async (): Promise<ListPipelineConfig[]> => {
  try {
    const url = getApiUrl('pipeline')
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      const pipelines: ListPipelineConfig[] = data.pipelines || []
      // Convert backend status to UI status for each pipeline
      const withStatus = pipelines.map((pipeline: ListPipelineConfig) => ({
        ...pipeline,
        // Handle both old format (state field) and new format (status field)
        status: getPipelineStatusFromState(pipeline.status || pipeline.state || ''),
      }))

      // Recompute transformation_type using full pipeline config to avoid backend misclassification
      const corrected = await Promise.all(
        withStatus.map(async (p) => {
          try {
            const full = await getPipeline(p.pipeline_id)
            const transformation = detectTransformationType(full)
            return { ...p, transformation_type: transformation }
          } catch {
            return p
          }
        }),
      )

      return corrected
    } else {
      throw { code: response.status, message: data.error || 'Failed to fetch pipelines' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch pipelines' } as ApiError
  }
}

export const getPipeline = async (id: string): Promise<Pipeline> => {
  try {
    const url = getApiUrl(`pipeline/${id}`)
    const response = await fetch(url)

    // Prefer wrapped success shape from our API routes
    if (response.ok) {
      const data = await response.json()
      if (data?.success === true) {
        const pipelinePayload = data.pipeline
        // Handle both old format (state field) and new format (status field)
        const backendStatus = pipelinePayload?.status || pipelinePayload?.state
        if (backendStatus !== undefined) {
          pipelinePayload.status = getPipelineStatusFromState(backendStatus)
        } else {
          pipelinePayload.status = 'active'
        }
        return pipelinePayload
      }
      // If backend returns direct object (no wrapper), accept that path
      if (data && typeof data === 'object' && data.pipeline_id) {
        const pipelinePayload = data
        // Handle both old format (state field) and new format (status field)
        const backendStatus = pipelinePayload?.status || pipelinePayload?.state
        if (backendStatus !== undefined) {
          pipelinePayload.status = getPipelineStatusFromState(backendStatus)
        } else {
          pipelinePayload.status = 'active'
        }
        return pipelinePayload
      }
      throw { code: response.status, message: data?.error || 'Failed to fetch pipeline' } as ApiError
    }

    // Non-200 → try fallback if in mock mode or as last resort
    throw { code: response.status, message: 'Failed to fetch pipeline' } as ApiError
  } catch (error: any) {
    // Fallback: if primary fetch failed (likely SSR/base/origin issues), try mock route directly
    try {
      const fallbackResponse = await fetch(`/ui-api/mock/pipeline/${id}`)
      const fb = await fallbackResponse.json()
      if (fallbackResponse.ok && fb?.success === true) {
        const pipelinePayload = fb.pipeline
        if (pipelinePayload.state !== undefined) {
          pipelinePayload.status = getPipelineStatusFromState(pipelinePayload.state)
        } else {
          pipelinePayload.status = 'active'
        }
        return pipelinePayload
      }
      throw { code: fallbackResponse.status, message: fb?.error || 'Failed to fetch pipeline (mock)' } as ApiError
    } catch (fbErr: any) {
      if (error.code) throw error
      throw { code: 500, message: error.message || 'Failed to fetch pipeline' } as ApiError
    }
  }
}

export const createPipeline = async (pipelineData: Partial<Pipeline>): Promise<Pipeline> => {
  try {
    const url = getApiUrl('pipeline')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pipelineData),
    })
    const data = await response.json()

    if (data.success) {
      return data.pipeline
    } else {
      throw { code: response.status, message: data.error || 'Failed to create pipeline' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to create pipeline' } as ApiError
  }
}

export const updatePipeline = async (id: string, updates: Partial<Pipeline>): Promise<Pipeline> => {
  try {
    const url = getApiUrl(`pipeline/${id}`)
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await response.json()

    if (data.success) {
      return data.pipeline
    } else {
      throw { code: response.status, message: data.error || 'Failed to update pipeline' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to update pipeline' } as ApiError
  }
}

export const terminatePipeline = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`pipeline/${id}/terminate`)
    const response = await fetch(url, { method: 'DELETE' })
    const data = await response.json()

    if (!data.success) {
      throw { code: response.status, message: data.error || 'Failed to terminate pipeline' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to terminate pipeline' } as ApiError
  }
}

// DEPRECATED: Use terminatePipeline instead - keeping for backward compatibility
export const deletePipeline = async (id: string, processEvents: boolean = false): Promise<void> => {
  // Always use terminate endpoint since shutdown is not implemented
  return terminatePipeline(id)
}

export const pausePipeline = async (id: string): Promise<Pipeline> => {
  try {
    const url = getApiUrl(`pipeline/${id}/pause`)
    const response = await fetch(url, { method: 'POST' })
    const data = await response.json()

    if (data.success) {
      return data.pipeline
    } else {
      throw { code: response.status, message: data.error || 'Failed to pause pipeline' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to pause pipeline' } as ApiError
  }
}

export const resumePipeline = async (id: string): Promise<Pipeline> => {
  try {
    const url = getApiUrl(`pipeline/${id}/resume`)
    const response = await fetch(url, { method: 'POST' })
    const data = await response.json()

    if (data.success) {
      return data.pipeline
    } else {
      throw { code: response.status, message: data.error || 'Failed to resume pipeline' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to resume pipeline' } as ApiError
  }
}

export const renamePipeline = async (id: string, newName: string): Promise<Pipeline> => {
  try {
    const url = getApiUrl(`pipeline/${id}`)
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    const data = await response.json()

    if (data.success) {
      return data.pipeline
    } else {
      throw { code: response.status, message: data.error || 'Failed to rename pipeline' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to rename pipeline' } as ApiError
  }
}

// DLQ API functions
export const getDLQState = async (pipelineId: string): Promise<DLQState> => {
  try {
    const url = getApiUrl(`pipeline/${pipelineId}/dlq/state`)
    const response = await fetch(url)

    if (!response.ok) {
      throw { code: response.status, message: 'Failed to fetch DLQ state' } as ApiError
    }

    const data = await response.json()
    return data
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch DLQ state' } as ApiError
  }
}

export const getDLQEvents = async (pipelineId: string): Promise<DLQEvent[]> => {
  try {
    const url = getApiUrl(`pipeline/${pipelineId}/dlq`)
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      return data.events || []
    } else {
      throw { code: response.status, message: data.error || 'Failed to fetch DLQ events' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch DLQ events' } as ApiError
  }
}

// Schema API functions
export const getSchemas = async (): Promise<Schema[]> => {
  try {
    const url = getApiUrl('schemas')
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      return data.schemas || []
    } else {
      throw { code: response.status, message: data.error || 'Failed to fetch schemas' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch schemas' } as ApiError
  }
}

export const getSchema = async (id: string): Promise<Schema> => {
  try {
    const url = getApiUrl(`schemas/${id}`)
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      return data.schema
    } else {
      throw { code: response.status, message: data.error || 'Failed to fetch schema' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch schema' } as ApiError
  }
}

export const createSchema = async (schemaData: Partial<Schema>): Promise<Schema> => {
  try {
    const url = getApiUrl('schemas')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schemaData),
    })
    const data = await response.json()

    if (data.success) {
      return data.schema
    } else {
      throw { code: response.status, message: data.error || 'Failed to create schema' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to create schema' } as ApiError
  }
}

export const updateSchema = async (id: string, updates: Partial<Schema>): Promise<Schema> => {
  try {
    const url = getApiUrl(`schemas/${id}`)
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await response.json()

    if (data.success) {
      return data.schema
    } else {
      throw { code: response.status, message: data.error || 'Failed to update schema' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to update schema' } as ApiError
  }
}

export const deleteSchema = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`schemas/${id}`)
    const response = await fetch(url, { method: 'DELETE' })
    const data = await response.json()

    if (!data.success) {
      throw { code: response.status, message: data.error || 'Failed to delete schema' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to delete schema' } as ApiError
  }
}

// Connection API functions (for future use)
export const getConnections = async (): Promise<Connection[]> => {
  try {
    const url = getApiUrl('connections')
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      return data.connections || []
    } else {
      throw { code: response.status, message: data.error || 'Failed to fetch connections' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch connections' } as ApiError
  }
}

export const getConnection = async (id: string): Promise<Connection> => {
  try {
    const url = getApiUrl(`connections/${id}`)
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      return data.connection
    } else {
      throw { code: response.status, message: data.error || 'Failed to fetch connection' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch connection' } as ApiError
  }
}

export const createConnection = async (connectionData: Partial<Connection>): Promise<Connection> => {
  try {
    const url = getApiUrl('connections')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connectionData),
    })
    const data = await response.json()

    if (data.success) {
      return data.connection
    } else {
      throw { code: response.status, message: data.error || 'Failed to create connection' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to create connection' } as ApiError
  }
}

export const updateConnection = async (id: string, updates: Partial<Connection>): Promise<Connection> => {
  try {
    const url = getApiUrl(`connections/${id}`)
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await response.json()

    if (data.success) {
      return data.connection
    } else {
      throw { code: response.status, message: data.error || 'Failed to update connection' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to update connection' } as ApiError
  }
}

export const deleteConnection = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`connections/${id}`)
    const response = await fetch(url, { method: 'DELETE' })
    const data = await response.json()

    if (!data.success) {
      throw { code: response.status, message: data.error || 'Failed to delete connection' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to delete connection' } as ApiError
  }
}
