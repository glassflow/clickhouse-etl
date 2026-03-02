import { getApiUrl, isMockMode } from '@/src/utils/mock-api'
import { structuredLogger } from '@/src/observability'
import type {
  Pipeline,
  ListPipelineConfig,
  Schema,
  Connection,
  DLQState,
  DLQEvent,
  ApiResponse,
  ApiError,
  PipelineMetadata,
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
              // Preserve metadata from list response, but merge with full pipeline metadata if available
              // Full pipeline metadata takes precedence as it's more complete
              metadata: full.metadata || p.metadata,
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

export const getPipeline = async (id: string): Promise<any> => {
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
            structuredLogger.warn('Failed to parse health data', { error: healthError instanceof Error ? healthError.message : String(healthError) })
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
            structuredLogger.warn('Failed to parse health data', { error: healthError instanceof Error ? healthError.message : String(healthError) })
          }
        }

        // Set the status from health endpoint
        pipelinePayload.status = status
        return pipelinePayload
      }

      throw { code: response.status, message: data?.error || 'Failed to fetch pipeline' } as ApiError
    }

    // Non-200 response - parse the error and throw with proper status code
    let errorMessage = 'Failed to fetch pipeline'
    const errorData = await response.json()
    errorMessage = errorData?.error || errorData?.message || errorMessage

    throw { code: response.status, message: errorMessage } as ApiError
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch pipeline' } as ApiError
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
      const pipeline = data.pipeline ?? {
        pipeline_id: data.pipeline_id,
        status: data.status || 'active',
      }
      return pipeline
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

export const editPipeline = async (id: string, config: Pipeline): Promise<Pipeline> => {
  try {
    const url = getApiUrl(`pipeline/${id}/edit`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    const data = await response.json()

    if (data.success) {
      return data.pipeline
    } else {
      const errorMessage = data.error || 'Failed to edit pipeline'

      // Handle specific backend validation errors
      if (response.status === 400 && errorMessage.includes('Pipeline must be stopped')) {
        throw {
          code: 400,
          message: 'Pipeline must be stopped before editing. Please pause the pipeline first.',
          requiresPause: true,
        } as ApiError
      }

      throw { code: response.status, message: errorMessage } as ApiError
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to edit pipeline' } as ApiError
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

export const updatePipelineMetadata = async (id: string, metadata: PipelineMetadata): Promise<void> => {
  try {
    const url = getApiUrl(`pipeline/${id}/metadata`)
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw { code: response.status, message: errorText || 'Failed to update pipeline metadata' } as ApiError
    }

    // Endpoint returns empty body on success, so nothing else to parse
    return
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to update pipeline metadata' } as ApiError
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
        structuredLogger.warn('Failed to fetch DLQ stats for pipeline', { pipeline_id: pipelineId, error: error instanceof Error ? error.message : String(error) })
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
    structuredLogger.error('Failed to fetch bulk DLQ stats', { error: error instanceof Error ? error.message : String(error) })
    // Return empty map if bulk fetch fails
    return {}
  }
}

export const purgePipelineDLQ = async (id: string): Promise<void> => {
  try {
    const url = getApiUrl(`pipeline/${id}/dlq/purge`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw { code: response.status, message: errorText || 'Failed to flush pipeline DLQ' } as ApiError
    }
    // Success: 204 No Content, no body to parse
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to flush pipeline DLQ' } as ApiError
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

// Filter validation API
export interface FilterValidationField {
  name: string
  type: string
}

export interface FilterValidationResult {
  valid: boolean
  error?: string
}

export const validateFilterExpression = async (
  expression: string,
  fields: FilterValidationField[],
): Promise<FilterValidationResult> => {
  try {
    const url = getApiUrl('filter/validate')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expression,
        fields: fields.map((f) => ({
          field_name: f.name,
          field_type: f.type,
        })),
      }),
    })

    if (response.ok) {
      return { valid: true }
    }

    // Handle validation error
    const data = await response.json()
    const errorMessage = data?.details?.error || data?.message || 'Invalid filter expression'
    return { valid: false, error: errorMessage }
  } catch (error: any) {
    return { valid: false, error: error.message || 'Failed to validate filter expression' }
  }
}

// Transformation expression evaluate API
export interface TransformExpressionItem {
  expression: string
  output_name: string
  output_type: string
}

export interface TransformationValidationResult {
  valid: boolean
  error?: string
}

export const validateTransformationExpression = async (
  transform: TransformExpressionItem[],
  sample: Record<string, unknown>,
): Promise<TransformationValidationResult> => {
  try {
    const url = getApiUrl('transform/expression/evaluate')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'expr_lang_transform',
        config: { transform },
        sample,
      }),
    })

    if (response.ok) {
      return { valid: true }
    }

    const data = await response.json()
    const errorMessage = data?.details?.error || data?.message || 'Failed to evaluate transformation'
    return { valid: false, error: errorMessage }
  } catch (error: any) {
    return { valid: false, error: error.message || 'Failed to validate transformation expression' }
  }
}

// Expression playground: evaluate a single expression and return the result
export interface ExpressionEvaluationResult {
  valid: boolean
  result?: Record<string, unknown>
  error?: string
}

export const evaluateExpression = async (
  expression: string,
  outputName: string,
  outputType: string,
  sample: Record<string, unknown>,
): Promise<ExpressionEvaluationResult> => {
  try {
    const url = getApiUrl('transform/expression/evaluate')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'expr_lang_transform',
        config: {
          transform: [
            { expression, output_name: outputName, output_type: outputType },
          ],
        },
        sample,
      }),
    })

    const data = response.ok ? await response.json().catch(() => ({})) : await response.json()

    if (response.ok) {
      const result = (data?.result ?? data) as Record<string, unknown> | undefined
      return { valid: true, result: result ?? undefined }
    }

    const errorMessage = data?.details?.error || data?.message || 'Failed to evaluate expression'
    return { valid: false, error: errorMessage }
  } catch (error: any) {
    return { valid: false, error: error?.message || 'Failed to evaluate expression' }
  }
}
