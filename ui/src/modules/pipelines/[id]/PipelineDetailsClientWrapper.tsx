'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import PipelineDetailsModule from './PipelineDetailsModule'
import PipelineDeploymentProgress from './PipelineDeploymentProgress'
import { PipelineNotFound } from '../PipelineNotFound'
import { useStore } from '@/src/store'
import { usePipelineDetailsData } from '@/src/hooks/usePipelineDetailsData'

interface PipelineDetailsClientWrapperProps {
  pipelineId: string
}

export default function PipelineDetailsClientWrapper({ pipelineId }: PipelineDetailsClientWrapperProps) {
  const [showDeploymentProgress, setShowDeploymentProgress] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const isDeploymentMode = searchParams?.get('deployment') === 'progress'

  // Get pipeline name from store if available (from recent pipeline creation)
  const { coreStore } = useStore()
  const { pipelineName } = coreStore

  // Use the centralized pipeline fetch hook
  // Skip initial fetch if in deployment mode (we'll fetch after deployment completes)
  const {
    pipeline,
    loading,
    error,
    isNotFound,
    refetch,
    setPipeline,
  } = usePipelineDetailsData(pipelineId, {
    skipInitialFetch: isDeploymentMode,
  })

  // Set deployment progress mode if URL parameter is present
  useEffect(() => {
    if (isDeploymentMode) {
      setShowDeploymentProgress(true)
    }
  }, [isDeploymentMode])

  // Handle deployment completion - fetch pipeline data after deployment
  const handleDeploymentComplete = async () => {
    setShowDeploymentProgress(false)
    // Remove deployment query parameter
    router.replace(`/pipelines/${pipelineId}`)
    // Fetch the pipeline data now that deployment is complete
    await refetch()
  }

  // Early return for loading state (only when not in deployment mode)
  if (loading && !showDeploymentProgress) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[var(--color-foreground-neutral-faded)]">Loading pipeline details...</p>
        </div>
      </div>
    )
  }

  if (isNotFound) {
    return <PipelineNotFound pipelineId={pipelineId} />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-[var(--color-foreground-neutral-faded)] text-lg font-semibold mb-2">Error</div>
          <p className="text-[var(--color-foreground-neutral-faded)]">{error}</p>
        </div>
      </div>
    )
  }

  const handleDeploymentFailed = (error: string) => {
    // Notification is already shown by useDeploymentProgress
    // Navigate back to pipelines list on failure
    router.push('/pipelines')
  }

  const handleNavigateToList = () => {
    router.push('/pipelines')
  }

  // Show deployment progress if in deployment mode
  if (showDeploymentProgress) {
    // Use pipeline name from store if available, otherwise fallback to ID
    const displayName = pipelineName || `Pipeline ${pipelineId.slice(0, 8)}`

    return (
      <div>
        <PipelineDeploymentProgress
          pipelineId={pipelineId}
          pipelineName={displayName}
          onDeploymentComplete={handleDeploymentComplete}
          onDeploymentFailed={handleDeploymentFailed}
          onNavigateToList={handleNavigateToList}
        />
      </div>
    )
  }

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-[var(--color-foreground-neutral-faded)] text-lg font-semibold mb-2">Pipeline Not Found</div>
          <p className="text-[var(--color-foreground-neutral-faded)]">Pipeline with ID &quot;{pipelineId}&quot; could not be found.</p>
        </div>
      </div>
    )
  }

  return <PipelineDetailsModule pipeline={pipeline} />
}
