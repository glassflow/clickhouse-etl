import { useState, useEffect, useCallback } from 'react'
import { checkBackendHealth } from '@/src/api/health'

interface HealthCheckState {
  isConnected: boolean
  isLoading: boolean
  lastChecked: Date | null
  error: string | null
}

export const useHealthCheck = (autoCheck: boolean = true) => {
  const [healthState, setHealthState] = useState<HealthCheckState>({
    isConnected: false,
    isLoading: false,
    lastChecked: null,
    error: null,
  })

  const performHealthCheck = useCallback(async () => {
    setHealthState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await checkBackendHealth()
      setHealthState({
        isConnected: result.success,
        isLoading: false,
        lastChecked: new Date(),
        error: null,
      })
      return result
    } catch (error: any) {
      setHealthState({
        isConnected: false,
        isLoading: false,
        lastChecked: new Date(),
        error: error.message || 'Health check failed',
      })
      throw error
    }
  }, [])

  // Auto-check on mount if enabled
  useEffect(() => {
    if (autoCheck) {
      performHealthCheck()
    }
  }, [autoCheck, performHealthCheck])

  return {
    ...healthState,
    performHealthCheck,
  }
}
