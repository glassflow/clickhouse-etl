import { useState, useEffect, useCallback, useRef } from 'react'
import { getPipelineHealth, PipelineHealth, PipelineHealthStatus, PipelineHealthError } from '../api/pipeline-health'
import { notify } from '@/src/notifications'
import { metricsMessages } from '@/src/notifications/messages'

export interface UsePipelineHealthOptions {
  pipelineId: string
  enabled?: boolean
  pollingInterval?: number // milliseconds
  onStatusChange?: (newStatus: PipelineHealthStatus, previousStatus: PipelineHealthStatus | null) => void
  onError?: (error: PipelineHealthError) => void
  onHealthUpdate?: (health: PipelineHealth) => void
  // Stop polling when pipeline reaches these statuses
  stopOnStatuses?: PipelineHealthStatus[]
  maxRetries?: number // Maximum consecutive errors before stopping
}

export interface UsePipelineHealthReturn {
  health: PipelineHealth | null
  isLoading: boolean
  error: PipelineHealthError | null
  isPolling: boolean
  refetch: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
}

export const usePipelineHealth = ({
  pipelineId,
  enabled = true,
  pollingInterval = 5000, // 5 seconds default - longer to be safe
  onStatusChange,
  onError,
  onHealthUpdate,
  stopOnStatuses = ['Running', 'Terminated', 'Failed'], // Stop on stable states
  maxRetries = 3,
}: UsePipelineHealthOptions): UsePipelineHealthReturn => {
  const [health, setHealth] = useState<PipelineHealth | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<PipelineHealthError | null>(null)
  const [hasStarted, setHasStarted] = useState(false)
  const [hasStopped, setHasStopped] = useState(false)
  const [errorCount, setErrorCount] = useState(0)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousStatusRef = useRef<PipelineHealthStatus | null>(null)

  // Single fetch function - no recursion, no complex state dependencies
  const fetchOnce = useCallback(async () => {
    if (!enabled || !pipelineId || hasStopped) {
      return
    }

    setIsLoading(true)

    try {
      const healthData = await getPipelineHealth(pipelineId)
      const newStatus = healthData.overall_status
      const previousStatus = previousStatusRef.current

      // Update state
      setHealth(healthData)
      setError(null)
      setErrorCount(0)
      previousStatusRef.current = newStatus

      // Call callbacks
      if (previousStatus !== newStatus) {
        onStatusChange?.(newStatus, previousStatus)
      }
      onHealthUpdate?.(healthData)

      // Check if we should stop polling
      if (stopOnStatuses.includes(newStatus)) {
        setHasStopped(true)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        return
      }

      // Schedule next fetch only if not stopped
      if (!hasStopped && enabled) {
        timeoutRef.current = setTimeout(fetchOnce, pollingInterval)
      }
    } catch (err: any) {
      const healthError = err as PipelineHealthError
      const newErrorCount = errorCount + 1

      setError(healthError)
      setErrorCount(newErrorCount)
      onError?.(healthError)

      // Stop on critical errors or max retries
      if (healthError.code === 404 || healthError.code >= 500 || newErrorCount >= maxRetries) {
        setHasStopped(true)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        // Show notification for persistent failures
        if (newErrorCount >= maxRetries) {
          notify(metricsMessages.fetchHealthFailed())
        }

        return
      }

      // Schedule retry for non-critical errors
      if (!hasStopped && enabled) {
        timeoutRef.current = setTimeout(fetchOnce, pollingInterval)
      }
    } finally {
      setIsLoading(false)
    }
  }, [
    pipelineId,
    enabled,
    hasStopped,
    errorCount,
    maxRetries,
    pollingInterval,
    onStatusChange,
    onError,
    onHealthUpdate,
    stopOnStatuses,
  ])

  // Start polling effect - runs only once when conditions are met
  useEffect(() => {
    if (enabled && pipelineId && !hasStarted && !hasStopped) {
      setHasStarted(true)
      fetchOnce()
    }
  }, [enabled, pipelineId, hasStarted, hasStopped, fetchOnce])

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [pipelineId])

  // Manual control functions
  const startPolling = useCallback(() => {
    if (!hasStopped) {
      setHasStarted(true)
      fetchOnce()
    }
  }, [hasStopped, fetchOnce])

  const stopPolling = useCallback(() => {
    setHasStopped(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [pipelineId])

  const refetch = useCallback(async () => {
    if (!hasStopped) {
      await fetchOnce()
    }
  }, [hasStopped, fetchOnce])

  return {
    health,
    isLoading,
    error,
    isPolling: hasStarted && !hasStopped,
    refetch,
    startPolling,
    stopPolling,
  }
}

/**
 * Hook for monitoring multiple pipelines' health
 */
export interface UseMultiplePipelineHealthOptions {
  pipelineIds: string[]
  enabled?: boolean
  pollingInterval?: number
  onStatusChange?: (
    pipelineId: string,
    newStatus: PipelineHealthStatus,
    previousStatus: PipelineHealthStatus | null,
  ) => void
  onError?: (pipelineId: string, error: PipelineHealthError) => void
}

export const useMultiplePipelineHealth = ({
  pipelineIds,
  enabled = true,
  pollingInterval = 5000, // 5 seconds for multiple pipelines
  onStatusChange,
  onError,
}: UseMultiplePipelineHealthOptions) => {
  const [healthMap, setHealthMap] = useState<Record<string, PipelineHealth>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, PipelineHealthError>>({})
  const [isPolling, setIsPolling] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)
  const previousStatusesRef = useRef<Record<string, PipelineHealthStatus>>({})
  const currentPipelineIdsRef = useRef<string[]>([])

  // Update pipeline IDs ref when they change
  useEffect(() => {
    currentPipelineIdsRef.current = pipelineIds
  }, [pipelineIds])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const fetchAllHealth = useCallback(async () => {
    const currentPipelineIds = currentPipelineIdsRef.current
    if (!enabled || currentPipelineIds.length === 0 || !isMountedRef.current) return

    const newLoadingMap: Record<string, boolean> = {}
    currentPipelineIds.forEach((id) => {
      newLoadingMap[id] = true
    })
    setLoadingMap(newLoadingMap)

    // Fetch health for all pipelines in parallel
    const healthPromises = currentPipelineIds.map(async (pipelineId) => {
      try {
        const health = await getPipelineHealth(pipelineId)

        if (!isMountedRef.current) return null

        const previousStatus = previousStatusesRef.current[pipelineId]
        const newStatus = health.overall_status

        // Update previous status
        previousStatusesRef.current[pipelineId] = newStatus

        // Call status change callback if status changed
        if (previousStatus !== newStatus) {
          onStatusChange?.(pipelineId, newStatus, previousStatus || null)
        }

        return { pipelineId, health, error: null }
      } catch (error) {
        const healthError = error as PipelineHealthError
        onError?.(pipelineId, healthError)
        return { pipelineId, health: null, error: healthError }
      }
    })

    const results = await Promise.all(healthPromises)

    if (!isMountedRef.current) return

    const newHealthMap: Record<string, PipelineHealth> = {}
    const newErrorMap: Record<string, PipelineHealthError> = {}
    const finalLoadingMap: Record<string, boolean> = {}

    results.forEach((result) => {
      if (result) {
        finalLoadingMap[result.pipelineId] = false
        if (result.health) {
          newHealthMap[result.pipelineId] = result.health
        }
        if (result.error) {
          newErrorMap[result.pipelineId] = result.error
        }
      }
    })

    setHealthMap((prev) => ({ ...prev, ...newHealthMap }))
    setErrorMap((prev) => ({ ...prev, ...newErrorMap }))
    setLoadingMap(finalLoadingMap)
  }, [enabled, onStatusChange, onError]) // Removed pipelineIds from dependencies

  const startPolling = useCallback(() => {
    if (!enabled || pipelineIds.length === 0 || intervalRef.current) return

    setIsPolling(true)
    fetchAllHealth() // Initial fetch
    intervalRef.current = setInterval(fetchAllHealth, pollingInterval)
  }, [enabled, pipelineIds.length, fetchAllHealth, pollingInterval])

  const stopPolling = useCallback(() => {
    setIsPolling(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Handle pipeline IDs changes - restart polling when pipeline list changes
  useEffect(() => {
    if (isPolling) {
      // If we're currently polling and pipeline IDs changed, restart
      stopPolling()
      if (enabled && pipelineIds.length > 0) {
        startPolling()
      }
    }
  }, [pipelineIds]) // Only restart when pipeline IDs actually change

  // Auto-start/stop polling
  useEffect(() => {
    if (enabled && pipelineIds.length > 0) {
      startPolling()
    } else {
      stopPolling()
    }

    return stopPolling
  }, [enabled, startPolling, stopPolling])

  // Update polling interval if it changes
  useEffect(() => {
    if (isPolling && intervalRef.current) {
      stopPolling()
      startPolling()
    }
  }, [pollingInterval, isPolling, startPolling, stopPolling])

  return {
    healthMap,
    loadingMap,
    errorMap,
    refetchAll: fetchAllHealth,
  }
}
