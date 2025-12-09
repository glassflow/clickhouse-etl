'use client'

import { useState } from 'react'
import { Card } from '@/src/components/ui/card'
import { DeploymentPhase } from './DeploymentStep'
import { useDeploymentProgress } from './useDeploymentProgress'
import { cn } from '@/src/utils/common.client'
import CheckGreenIcon from '@/src/images/icon-check-green.svg'
import XRedIcon from '@/src/images/icon-x-red.svg'
import Image from 'next/image'
import LoaderSmall from '@/src/images/loader-small.svg'

interface PipelineDeploymentProgressProps {
  pipelineId: string
  pipelineName: string
  onDeploymentComplete: () => void
  onDeploymentFailed?: (error: string) => void
  onNavigateToList?: () => void
}

const OperationSuccess = ({ label }: { label: string }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        <Image src={CheckGreenIcon} alt="Success" width={16} height={16} />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  )
}

const OperationFailed = ({ label }: { label: string }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        <Image src={XRedIcon} alt="Failed" width={16} height={16} />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  )
}

const OperationLoading = ({ label }: { label: string }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        <Image src={LoaderSmall} alt="Loading" width={16} height={16} />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  )
}

const DeploymentIndicator = ({ deploymentPhase }: { deploymentPhase: DeploymentPhase }) => {
  return (
    <div className="flex items-center gap-3">
      {deploymentPhase === 'deploying' ? (
        <OperationLoading label="Deploying..." />
      ) : deploymentPhase === 'deployed' ? (
        <OperationSuccess label="Pipeline deployed." />
      ) : deploymentPhase === 'failed' ? (
        <OperationFailed label="Deployment failed." />
      ) : (
        <OperationLoading label="Loading..." />
      )}
    </div>
  )
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
        // Show transition effect and navigate
        setShowTransition(true)
        setTimeout(() => {
          onDeploymentComplete()
        }, 1000) // Fade transition time
      },
      onDeploymentFailed: (error) => {
        // Show transition effect and navigate
        setShowTransition(true)
        setTimeout(() => {
          onDeploymentFailed?.(error)
        }, 1000) // Fade transition time
      },
    })

  return (
    <div className={cn('transition-opacity duration-500', showTransition && 'opacity-0')}>
      <div className="flex flex-col gap-4">
        {/* Main Header Card - Similar to PipelineDetailsHeader */}
        <Card className="card-outline py-2 px-6 mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col flex-start gap-2">
              <h2 className="text-2xl font-bold">{pipelineName}</h2>
              {/* <Badge variant={getStatusVariant(deploymentPhase)} className="rounded-xl my-2 mx-4">
                  {getStatusLabel(deploymentPhase)}
                </Badge> */}

              {/* Error badge */}
              {/* {deploymentPhase === 'failed' && error && (
                  <Badge variant="destructive" className="ml-2">
                    Failed
                  </Badge>
                )} */}
            </div>

            <OperationSuccess label="Pipeline created." />
            <DeploymentIndicator deploymentPhase={deploymentPhase} />
          </div>
        </Card>
      </div>
    </div>
  )
}

export default PipelineDeploymentProgress
