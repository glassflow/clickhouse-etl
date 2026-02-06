/**
 * Hook for fetching and managing pipeline details data.
 *
 * Centralizes pipeline fetch logic with loading/error/notFound states.
 * Used by PipelineDetailsClientWrapper and can be used after deployment completion.
 *
 * Features:
 * - Automatic initial fetch on mount (unless disabled)
 * - Error handling with 404 detection
 * - Centralized API error handling integration
 * - Refetch capability for post-action refresh
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { getPipeline } from '@/src/api/pipeline-api'
import { handleApiError } from '@/src/notifications/api-error-handler'
import type { Pipeline, ApiError } from '@/src/types/pipeline'

export interface UsePipelineDetailsDataOptions {
  /**
   * If true, skips the initial fetch on mount.
   * Useful when you want to control when the fetch happens (e.g., deployment mode).
   */
  skipInitialFetch?: boolean
}

export interface UsePipelineDetailsDataResult {
  /** The fetched pipeline data, or null if not yet loaded or not found */
  pipeline: Pipeline | null
  /** Whether a fetch is currently in progress */
  loading: boolean
  /** Error message if fetch failed (non-404 errors) */
  error: string | null
  /** Whether the pipeline was not found (404 response) */
  isNotFound: boolean
  /** Function to manually fetch/refetch the pipeline data */
  refetch: () => Promise<Pipeline | null>
  /** Function to update the local pipeline state (for optimistic updates) */
  setPipeline: React.Dispatch<React.SetStateAction<Pipeline | null>>
}

/**
 * Hook for fetching pipeline details by ID.
 *
 * @param pipelineId - The ID of the pipeline to fetch
 * @param options - Optional configuration
 * @returns Pipeline data and fetch state
 *
 * @example
 * ```tsx
 * const { pipeline, loading, error, isNotFound, refetch } = usePipelineDetailsData(pipelineId)
 *
 * if (loading) return <Loading />
 * if (isNotFound) return <NotFound />
 * if (error) return <Error message={error} />
 * if (!pipeline) return null
 *
 * return <PipelineDetails pipeline={pipeline} />
 * ```
 */
export function usePipelineDetailsData(
  pipelineId: string,
  options: UsePipelineDetailsDataOptions = {}
): UsePipelineDetailsDataResult {
  const { skipInitialFetch = false } = options

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(!skipInitialFetch)
  const [error, setError] = useState<string | null>(null)
  const [isNotFound, setIsNotFound] = useState(false)

  // Track if this is the initial mount to handle skipInitialFetch correctly
  const isInitialMount = useRef(true)

  /**
   * Fetch pipeline data from the API.
   * Handles 404 separately from other errors.
   */
  const fetchPipeline = useCallback(async (): Promise<Pipeline | null> => {
    try {
      setLoading(true)
      setError(null)
      setIsNotFound(false)

      const data = await getPipeline(pipelineId)
      setPipeline(data)
      return data
    } catch (err: unknown) {
      const apiError = err as ApiError

      // Check if this is a 404 error (pipeline not found)
      if (apiError?.code === 404) {
        setIsNotFound(true)
        setPipeline(null)
        return null
      }

      // Handle other errors
      const errorMessage = (err as Error)?.message || 'Failed to fetch pipeline'
      setError(errorMessage)
      setPipeline(null)

      // Show notification for non-404 errors using centralized error handler
      handleApiError(err, {
        operation: 'fetch',
        retryFn: () => fetchPipeline(),
      })

      return null
    } finally {
      setLoading(false)
    }
  }, [pipelineId])

  // Initial fetch on mount (unless skipped)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false

      if (!skipInitialFetch) {
        fetchPipeline()
      }
    }
  }, [fetchPipeline, skipInitialFetch])

  // Refetch when pipelineId changes (after initial mount)
  useEffect(() => {
    if (!isInitialMount.current && !skipInitialFetch) {
      fetchPipeline()
    }
  }, [pipelineId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    pipeline,
    loading,
    error,
    isNotFound,
    refetch: fetchPipeline,
    setPipeline,
  }
}
