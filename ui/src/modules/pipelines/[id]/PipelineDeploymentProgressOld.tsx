'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import DeploymentStep, { DeploymentPhase } from './DeploymentStep'
import { useDeploymentProgress } from './useDeploymentProgress'
import { cn } from '@/src/utils/common.client'

interface PipelineDeploymentProgressProps {
  pipelineId: string
  pipelineName: string
  onDeploymentComplete: () => void
  onDeploymentFailed?: (error: string) => void
  onNavigateToList?: () => void
}

const PipelineDeploymentProgress = ({
  pipelineId,
  pipelineName,
  onDeploymentComplete,
  onDeploymentFailed,
  onNavigateToList,
}: PipelineDeploymentProgressProps) => {
  const [showTransition, setShowTransition] = useState(false)

  const { deploymentPhase, deploymentHistory, error, isPolling, retryDeployment, timeoutReached } =
    useDeploymentProgress({
      pipelineId,
      onDeploymentComplete: () => {
        // Show success state for 2 seconds before transitioning
        setTimeout(() => {
          setShowTransition(true)
          setTimeout(() => {
            onDeploymentComplete()
          }, 500) // Fade transition time
        }, 2000)
      },
      onDeploymentFailed: (error) => {
        onDeploymentFailed?.(error)
      },
    })

  const getStatusVariant = (phase: DeploymentPhase) => {
    switch (phase) {
      case 'created':
        return 'default'
      case 'deploying':
        return 'secondary'
      case 'deployed':
        return 'success'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (phase: DeploymentPhase) => {
    switch (phase) {
      case 'created':
        return 'Created'
      case 'deploying':
        return 'Deploying'
      case 'deployed':
        return 'Deployed'
      case 'failed':
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  const getPhaseDescription = (phase: DeploymentPhase) => {
    switch (phase) {
      case 'created':
        return 'Configuration saved successfully'
      case 'deploying':
        return 'Setting up your data pipeline infrastructure...'
      case 'deployed':
        return 'Pipeline is now active and processing data'
      case 'failed':
        return error || 'An error occurred during deployment'
      default:
        return ''
    }
  }

  const isPhaseCompleted = (checkPhase: DeploymentPhase) => {
    const phaseOrder = ['created', 'deploying', 'deployed']
    const currentIndex = phaseOrder.indexOf(deploymentPhase)
    const checkIndex = phaseOrder.indexOf(checkPhase)

    if (deploymentPhase === 'failed') {
      // Only 'created' is completed if we failed
      return checkPhase === 'created'
    }

    return checkIndex < currentIndex || deploymentPhase === checkPhase
  }

  const handleRetry = () => {
    retryDeployment()
  }

  const handleNavigateToList = () => {
    onNavigateToList?.()
  }

  return (
    <div className={cn('min-h-screen bg-[var(--color-background-page)] transition-opacity duration-500', showTransition && 'opacity-0')}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Section */}
          <Card className="card-outline">
            <div className="flex flex-col items-center p-8 text-center">
              <h1 className="text-3xl font-bold text-[var(--color-foreground-neutral)] mb-4">{pipelineName}</h1>
              <Badge variant={getStatusVariant(deploymentPhase)} className="text-lg px-4 py-2 rounded-xl">
                {getStatusLabel(deploymentPhase)}
              </Badge>
              {isPolling && (
                <div className="mt-3 text-sm text-[var(--color-foreground-info)] animate-pulse">Monitoring deployment progress...</div>
              )}
            </div>
          </Card>

          {/* Progress Section */}
          <Card className="card-outline">
            <div className="p-8">
              <h2 className="text-xl font-semibold text-[var(--color-foreground-neutral)] mb-6">Deployment Progress</h2>

              <div className="space-y-4">
                {/* Created Phase */}
                <DeploymentStep
                  phase="created"
                  isActive={deploymentPhase === 'created'}
                  isCompleted={isPhaseCompleted('created')}
                  title="Pipeline Created"
                  description={getPhaseDescription('created')}
                  timestamp={deploymentHistory.find((h) => h.phase === 'created')?.timestamp}
                />

                {/* Deploying Phase */}
                <DeploymentStep
                  phase="deploying"
                  isActive={deploymentPhase === 'deploying'}
                  isCompleted={isPhaseCompleted('deploying')}
                  title="Deploying Pipeline"
                  description={getPhaseDescription('deploying')}
                  timestamp={deploymentHistory.find((h) => h.phase === 'deploying')?.timestamp}
                />

                {/* Final Phase */}
                <DeploymentStep
                  phase={deploymentPhase === 'failed' ? 'failed' : 'deployed'}
                  isActive={deploymentPhase === 'deployed' || deploymentPhase === 'failed'}
                  isCompleted={deploymentPhase === 'deployed'}
                  isFailed={deploymentPhase === 'failed'}
                  title={deploymentPhase === 'failed' ? 'Deployment Failed' : 'Pipeline Deployed'}
                  description={getPhaseDescription(deploymentPhase)}
                  timestamp={deploymentHistory.find((h) => h.phase === 'deployed' || h.phase === 'failed')?.timestamp}
                />
              </div>
            </div>
          </Card>

          {/* Error Handling */}
          {deploymentPhase === 'failed' && (
            <Card className="border-[var(--color-border-critical)] bg-[var(--color-background-critical-faded)] shadow-sm">
              <div className="p-6">
                <div className="flex items-start space-x-3">
                  <XCircleIcon className="w-6 h-6 text-[var(--color-foreground-critical)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[var(--color-foreground-critical)] mb-2">Deployment Failed</h3>
                    <p className="text-[var(--color-foreground-critical)] mb-4">
                      {error || 'An unexpected error occurred during pipeline deployment.'}
                    </p>

                    {timeoutReached && (
                      <div className="bg-[var(--color-background-critical-faded)] border border-[var(--color-border-critical)] rounded-md p-3 mb-4">
                        <p className="text-sm text-[var(--color-foreground-critical)]">
                          <strong>Timeout:</strong> The deployment process took longer than expected (5 minutes). This
                          could indicate a configuration issue or resource constraints.
                        </p>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <Button onClick={handleRetry} variant="primary" size="custom" disabled={isPolling}>
                        <ArrowPathIcon className="w-4 h-4 mr-2" />
                        Retry Deployment
                      </Button>

                      <Button onClick={handleNavigateToList} variant="secondary" size="custom">
                        Back to Pipelines
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Success Message */}
          {deploymentPhase === 'deployed' && (
            <Card className="border-[var(--color-border-positive)] bg-[var(--color-background-positive-faded)] shadow-sm">
              <div className="p-6 text-center">
                <div className="text-[var(--color-foreground-positive)] mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-foreground-positive)] mb-2">Deployment Successful!</h3>
                <p className="text-[var(--color-foreground-positive)]">
                  Your pipeline is now active and ready to process data. You&apos;ll be redirected to the pipeline
                  details shortly.
                </p>
              </div>
            </Card>
          )}

          {/* Development Info */}
          {process.env.NODE_ENV === 'development' && (
            <Card className="border-[var(--color-border-neutral-faded)] bg-[var(--color-background-neutral-faded)] shadow-sm">
              <div className="p-4">
                <h4 className="text-sm font-medium text-[var(--color-foreground-neutral-faded)] mb-2">Debug Info</h4>
                <div className="text-xs text-[var(--color-foreground-neutral-faded)] space-y-1">
                  <div>Pipeline ID: {pipelineId}</div>
                  <div>Current Phase: {deploymentPhase}</div>
                  <div>Is Polling: {isPolling ? 'Yes' : 'No'}</div>
                  <div>History Length: {deploymentHistory.length}</div>
                  {error && <div>Error: {error}</div>}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default PipelineDeploymentProgress
