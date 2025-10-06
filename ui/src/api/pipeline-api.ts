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
import {
  parsePipelineStatus,
  detectTransformationType,
  PipelineStatus,
  PipelineResponse,
  PipelineError,
} from '@/src/types/pipeline'

// Pipeline API functions
export const getPipelines = async (): Promise<ListPipelineConfig[]> => {
  try {
    const url = getApiUrl('pipeline')
    const response = await fetch(url)
    const data = await response.json()

    if (data.success) {
      const pipelines: ListPipelineConfig[] = data.pipelines || []
      // Parse backend status to UI status for each pipeline
      const withStatus = pipelines.map((pipeline: ListPipelineConfig) => ({
        ...pipeline,
        // Parse backend status to UI status - backend return Uppercase first letter of the status
        status: parsePipelineStatus(pipeline.status || ''),
      }))

      // Get pipeline IDs for DLQ stats fetching
      const pipelineIds = withStatus.map((p) => p.pipeline_id)

      // Fetch DLQ stats for all pipelines in parallel
      const dlqStatsMap = await getBulkDLQStats(pipelineIds)

      // Recompute transformation_type using full pipeline config to avoid backend misclassification
      // and add DLQ stats and stability status
      const corrected = await Promise.all(
        withStatus.map(async (p) => {
          try {
            const full = await getPipeline(p.pipeline_id)
            const transformation = detectTransformationType(full)

            // Get DLQ stats for this pipeline
            const dlqStats = dlqStatsMap[p.pipeline_id]

            // Determine stability status based on DLQ stats
            const healthStatus: 'stable' | 'unstable' =
              dlqStats && dlqStats.unconsumed_messages > 0 ? 'unstable' : 'stable'

            return {
              ...p,
              transformation_type: transformation,
              dlq_stats: dlqStats
                ? {
                    total_messages: dlqStats.total_messages,
                    unconsumed_messages: dlqStats.unconsumed_messages,
                    last_received_at: dlqStats.last_received_at,
                    last_consumed_at: dlqStats.last_consumed_at,
                  }
                : undefined,
              health_status: healthStatus,
            }
          } catch {
            return {
              ...p,
              dlq_stats: undefined,
              health_status: 'stable' as const, // Default to stable if we can't determine
            }
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
    const urlHealth = getApiUrl(`pipeline/${id}/health`)

    // Fetch both pipeline data and health status in parallel
    const [response, responseHealth] = await Promise.all([fetch(url), fetch(urlHealth)])

    // Prefer wrapped success shape from our API routes
    if (response.ok) {
      const data = await response.json()
      if (data?.success === true) {
        const pipelinePayload = data.pipeline

        // Get status from health endpoint
        let status = 'active' // default fallback
        if (responseHealth.ok) {
          try {
            const healthData = await responseHealth.json()
            if (healthData?.overall_status) {
              status = parsePipelineStatus(healthData.overall_status)
            }
          } catch (healthError) {
            console.warn('Failed to parse health data:', healthError)
          }
        }

        // Set the status from health endpoint
        pipelinePayload.status = status
        return pipelinePayload
      }

      // If backend returns direct object (no wrapper), accept that path
      if (data && typeof data === 'object' && data.pipeline_id) {
        const pipelinePayload = data

        // Get status from health endpoint
        let status = 'active' // default fallback
        if (responseHealth.ok) {
          try {
            const healthData = await responseHealth.json()
            if (healthData?.overall_status) {
              status = parsePipelineStatus(healthData.overall_status)
            }
          } catch (healthError) {
            console.warn('Failed to parse health data:', healthError)
          }
        }

        // Set the status from health endpoint
        pipelinePayload.status = status
        return pipelinePayload
      }

      throw { code: response.status, message: data?.error || 'Failed to fetch pipeline' } as ApiError
    }

    // Non-200 → try fallback if in mock mode or as last resort
    throw { code: response.status, message: 'Failed to fetch pipeline' } as ApiError
  } catch (error: any) {
    // Fallback: if primary fetch failed (likely SSR/base/origin issues), try mock route directly
    try {
      const [fallbackResponse, fallbackHealthResponse] = await Promise.all([
        fetch(`/ui-api/mock/pipeline/${id}`),
        fetch(`/ui-api/mock/pipeline/${id}/health`),
      ])
      const fb = await fallbackResponse.json()

      if (fallbackResponse.ok && fb?.success === true) {
        const pipelinePayload = fb.pipeline

        // Get status from mock health endpoint
        let status = 'active' // default fallback
        if (fallbackHealthResponse.ok) {
          try {
            const healthData = await fallbackHealthResponse.json()
            if (healthData?.health?.overall_status) {
              status = parsePipelineStatus(healthData.health.overall_status)
            }
          } catch (healthError) {
            console.warn('Failed to parse mock health data:', healthError)
          }
        }

        // Set the status from health endpoint
        pipelinePayload.status = status
        return pipelinePayload
      }

      throw { code: fallbackResponse.status, message: fb?.error || 'Failed to fetch pipeline (mock)' } as ApiError
    } catch (fbErr: any) {
      if (error.code) throw error
      throw { code: 500, message: error.message || 'Failed to fetch pipeline' } as ApiError
    }
  }
}

/**
 * Check if a pipeline exists by ID
 */
export const checkPipelineExists = async (pipelineId: string): Promise<boolean> => {
  try {
    const url = getApiUrl(`pipeline/${pipelineId}`)
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    // If we get a successful response, the pipeline exists
    return response.status === 200
  } catch (error: any) {
    // If we get a 404, the pipeline doesn't exist
    if (error.status === 404) {
      return false
    }

    // For other errors, we'll assume it doesn't exist to be safe
    return false
  }
}

/**
 * Create a new pipeline
 */
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

export const stopPipeline = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`pipeline/${id}/stop`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw { code: response.status, message: errorText || 'Failed to stop pipeline' } as ApiError
    }
    // Success: 204 No Content, no body to parse
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to stop pipeline' } as ApiError
  }
}

export const terminatePipeline = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`pipeline/${id}/terminate`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw { code: response.status, message: errorText || 'Failed to terminate pipeline' } as ApiError
    }
    // Success: 204 No Content, no body to parse
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to terminate pipeline' } as ApiError
  }
}

export const deletePipeline = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`pipeline/${id}`)
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw { code: response.status, message: errorText || 'Failed to delete pipeline' } as ApiError
    }
    // Success: 204 No Content, no body to parse
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to delete pipeline' } as ApiError
  }
}

export const pausePipeline = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`pipeline/${id}/pause`)
    const response = await fetch(url, { method: 'POST' })
    const data = await response.json()

    if (!response.ok) {
      throw { code: response.status, message: data.error || 'Failed to pause pipeline' } as ApiError
    }

    if (!data.success) {
      throw { code: response.status, message: data.error || 'Failed to pause pipeline' } as ApiError
    }

    return
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to pause pipeline' } as ApiError
  }
}

export const resumePipeline = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`pipeline/${id}/resume`)
    const response = await fetch(url, { method: 'POST' })
    const data = await response.json()

    if (!response.ok) {
      throw { code: response.status, message: data.error || 'Failed to resume pipeline' } as ApiError
    }

    if (!data.success) {
      throw { code: response.status, message: data.error || 'Failed to resume pipeline' } as ApiError
    }

    return
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

// Bulk DLQ stats fetcher for multiple pipelines
export const getBulkDLQStats = async (pipelineIds: string[]): Promise<Record<string, DLQState | null>> => {
  try {
    // Fetch DLQ stats for all pipelines in parallel
    const dlqPromises = pipelineIds.map(async (pipelineId) => {
      try {
        const dlqState = await getDLQState(pipelineId)
        return { pipelineId, dlqState }
      } catch (error) {
        // If DLQ fetch fails for a pipeline, return null for that pipeline
        console.warn(`Failed to fetch DLQ stats for pipeline ${pipelineId}:`, error)
        return { pipelineId, dlqState: null }
      }
    })

    const results = await Promise.all(dlqPromises)

    // Convert array to object for easy lookup
    const dlqStatsMap: Record<string, DLQState | null> = {}
    results.forEach(({ pipelineId, dlqState }) => {
      dlqStatsMap[pipelineId] = dlqState
    })

    return dlqStatsMap
  } catch (error: any) {
    console.error('Failed to fetch bulk DLQ stats:', error)
    // Return empty map if bulk fetch fails
    return {}
  }
}

// ClickHouse Metrics API functions
export interface ClickHouseTableMetrics {
  database: string
  table: string
  lastUpdated: string
  rowCount: number
  tableSizeBytes: number
  compressedSizeBytes: number
  insertRateRowsPerSec: number
  insertRateBytesPerSec: number
  insertLatencyP50Ms: number
  insertLatencyP95Ms: number
  failedInserts: number
  failedInsertsLast5Min: number
  rowCountDelta1H: number
  tableSizeDelta1H: number
  mergesInProgress: number
  mutationsInProgress: number
  memoryUsageBytes: number
  activeQueries: number
}

export const getClickHouseMetrics = async (pipelineId: string): Promise<ClickHouseTableMetrics> => {
  try {
    const url = getApiUrl(`pipeline/${pipelineId}/clickhouse/metrics`)
    const response = await fetch(url)

    if (!response.ok) {
      throw { code: response.status, message: 'Failed to fetch ClickHouse metrics' } as ApiError
    }

    const data = await response.json()

    if (!data.success) {
      throw { code: 500, message: data.error || 'Failed to fetch ClickHouse metrics' } as ApiError
    }

    return data.metrics
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch ClickHouse metrics' } as ApiError
  }
}

export const getClickHouseMetricsFromConfig = async (pipeline: Pipeline): Promise<ClickHouseTableMetrics> => {
  try {
    const url = getApiUrl(`pipeline/${pipeline.pipeline_id}/clickhouse/metrics-from-config`)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pipeline }),
    })

    if (!response.ok) {
      throw { code: response.status, message: 'Failed to fetch ClickHouse metrics' } as ApiError
    }

    const data = await response.json()

    if (!data.success) {
      throw { code: 500, message: data.error || 'Failed to fetch ClickHouse metrics' } as ApiError
    }

    return data.metrics
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch ClickHouse metrics' } as ApiError
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
