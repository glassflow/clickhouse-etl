import { getApiUrl, isMockMode } from '@/src/utils/mock-api'

// Type definitions matching the API specification
export interface Pipeline {
  id: string
  name: string
  status: 'active' | 'paused' | 'terminated' | 'deleted'
  created_at: string
  updated_at: string
  config: {
    kafka: {
      topics: string[]
      consumer_group: string
    }
    clickhouse: {
      database: string
      table: string
    }
    operations: string[]
  }
  stats: {
    events_processed: number
    events_failed: number
    throughput_per_second: number
    last_event_processed: string | null
  }
  error?: string
}

export interface Schema {
  id: string
  name: string
  version: string
  created_at: string
  updated_at: string
  schema: Record<string, any>
  mappings: Record<string, any>
}

export interface Connection {
  id: string
  name: string
  type: 'kafka' | 'clickhouse'
  created_at: string
  updated_at: string
  config: Record<string, any>
}

export interface DLQStats {
  total_failed_events: number
  failed_events_today: number
  last_failure: string
  failure_rate: number
  top_error_types: Array<{ error_type: string; count: number }>
}

export interface DLQEvent {
  id: string
  original_event: Record<string, any>
  error: string
  failed_at: string
  retry_count: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  code: number
  message: string
}

// Pipeline API functions
export const getPipelines = async (): Promise<Pipeline[]> => {
  try {
    const url = getApiUrl('pipelines')
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      return data.pipelines || []
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
    const url = getApiUrl(`pipelines/${id}`)
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      return data.pipeline
    } else {
      throw { code: response.status, message: data.error || 'Failed to fetch pipeline' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch pipeline' } as ApiError
  }
}

export const createPipeline = async (pipelineData: Partial<Pipeline>): Promise<Pipeline> => {
  try {
    const url = getApiUrl('pipelines')
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
    const url = getApiUrl(`pipelines/${id}`)
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

export const deletePipeline = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`pipelines/${id}`)
    const response = await fetch(url, { method: 'DELETE' })
    const data = await response.json()

    if (!data.success) {
      throw { code: response.status, message: data.error || 'Failed to delete pipeline' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to delete pipeline' } as ApiError
  }
}

// DLQ API functions
export const getDLQStats = async (pipelineId: string): Promise<DLQStats> => {
  try {
    const url = getApiUrl(`pipelines/${pipelineId}/dlq/stats`)
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      return data.stats
    } else {
      throw { code: response.status, message: data.error || 'Failed to fetch DLQ stats' } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch DLQ stats' } as ApiError
  }
}

export const getDLQEvents = async (pipelineId: string): Promise<DLQEvent[]> => {
  try {
    const url = getApiUrl(`pipelines/${pipelineId}/dlq`)
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
