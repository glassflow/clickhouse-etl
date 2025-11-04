import { useState, useEffect, useCallback } from 'react'
import { usePipelineHealth } from '@/src/hooks/usePipelineHealth'
import { DeploymentPhase } from './DeploymentStep'

interface DeploymentState {
  phase: DeploymentPhase
  message: string
  timestamp: Date
  error?: string
}

interface UseDeploymentProgressOptions {
  pipelineId: string
  onDeploymentComplete?: () => void
  onDeploymentFailed?: (error: string) => void
  maxDeploymentTime?: number // in milliseconds, default 5 minutes
  autoNavigateDelay?: number // delay before auto-navigation, default 2 seconds
}

interface UseDeploymentProgressReturn {
  deploymentPhase: DeploymentPhase
  deploymentHistory: DeploymentState[]
  error: string | null
  isPolling: boolean
  retryDeployment: () => void
  timeoutReached: boolean
}

export const useDeploymentProgress = ({
  pipelineId,
  onDeploymentComplete,
  onDeploymentFailed,
  maxDeploymentTime = 5 * 60 * 1000, // 5 minutes
  autoNavigateDelay = 2000, // 2 seconds
}: UseDeploymentProgressOptions): UseDeploymentProgressReturn => {
  const [deploymentPhase, setDeploymentPhase] = useState<DeploymentPhase>('created')
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentState[]>([])
  const [error, setError] = useState<string | null>(null)
  const [timeoutReached, setTimeoutReached] = useState(false)
  const [startTime] = useState(Date.now())

  // Add deployment state to history
  const addDeploymentState = useCallback((phase: DeploymentPhase, message: string, error?: string) => {
    const newState: DeploymentState = {
      phase,
      message,
      timestamp: new Date(),
      error,
    }
    setDeploymentHistory((prev) => [...prev, newState])
  }, [])

  // Initialize with 'created' phase
  useEffect(() => {
    addDeploymentState('created', 'Pipeline configuration saved successfully')

    // Transition to 'deploying' after 1.5 seconds
    const timer = setTimeout(() => {
      setDeploymentPhase('deploying')
      addDeploymentState('deploying', 'Starting pipeline deployment...')
    }, 1500)

    return () => clearTimeout(timer)
  }, [addDeploymentState])

  // Setup timeout for maximum deployment time
  useEffect(() => {
    const timeoutTimer = setTimeout(() => {
      if (deploymentPhase === 'deploying') {
        setTimeoutReached(true)
        setDeploymentPhase('failed')
        const timeoutError = 'Deployment timeout: Pipeline took too long to deploy'
        setError(timeoutError)
        addDeploymentState('failed', 'Deployment timed out after 5 minutes', timeoutError)

        // Auto-navigate to pipelines list after delay for timeout
        setTimeout(() => {
          onDeploymentFailed?.(timeoutError)
        }, autoNavigateDelay)
      }
    }, maxDeploymentTime)

    return () => clearTimeout(timeoutTimer)
  }, [deploymentPhase, maxDeploymentTime, addDeploymentState, onDeploymentFailed])

  // Poll pipeline health when in 'deploying' phase
  const {
    health,
    isLoading,
    error: healthError,
  } = usePipelineHealth({
    pipelineId,
    enabled: deploymentPhase === 'deploying' && !timeoutReached,
    pollingInterval: 2000, // Aggressive polling every 2 seconds for deployment
    stopOnStatuses: ['Running', 'Failed', 'Terminated'],
    maxRetries: 5, // Allow more retries during deployment
    onStatusChange: (newStatus, previousStatus) => {
      if (newStatus === 'Running') {
        setDeploymentPhase('deployed')
        addDeploymentState('deployed', 'Pipeline deployed successfully and is now running')

        // Auto-navigate to pipeline details after delay
        setTimeout(() => {
          onDeploymentComplete?.()
        }, autoNavigateDelay)
      } else if (newStatus === 'Failed' || newStatus === 'Terminated') {
        setDeploymentPhase('failed')
        const failureMessage =
          newStatus === 'Failed' ? 'Pipeline deployment failed' : 'Pipeline was terminated during deployment'
        setError(failureMessage)
        addDeploymentState('failed', failureMessage, failureMessage)

        // Auto-navigate to pipelines list after delay
        setTimeout(() => {
          onDeploymentFailed?.(failureMessage)
        }, autoNavigateDelay)
      }
    },
    onError: (healthError) => {
      console.error('[DeploymentProgress] Health check error:', healthError)

      // Only treat as deployment failure if we've been polling for a while
      // or if it's a critical error
      const elapsedTime = Date.now() - startTime
      const isCriticalError = healthError.code === 404 || healthError.code === 500

      if (elapsedTime > 30000 || isCriticalError) {
        // 30 seconds
        setDeploymentPhase('failed')
        const errorMessage = `Deployment monitoring failed: ${healthError.message}`
        setError(errorMessage)
        addDeploymentState('failed', 'Unable to monitor deployment progress', errorMessage)

        // Auto-navigate to pipelines list after delay for health error
        setTimeout(() => {
          onDeploymentFailed?.(errorMessage)
        }, autoNavigateDelay)
      }
    },
  })

  // Retry deployment function
  const retryDeployment = useCallback(() => {
    setDeploymentPhase('deploying')
    setError(null)
    setTimeoutReached(false)
    addDeploymentState('deploying', 'Retrying pipeline deployment...')
  }, [addDeploymentState])

  return {
    deploymentPhase,
    deploymentHistory,
    error,
    isPolling: isLoading && deploymentPhase === 'deploying',
    retryDeployment,
    timeoutReached,
  }
}
