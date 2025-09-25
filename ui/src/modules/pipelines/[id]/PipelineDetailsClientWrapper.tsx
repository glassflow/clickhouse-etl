'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getPipeline } from '@/src/api/pipeline-api'
import PipelineDetailsModule from './PipelineDetailsModule'
import PipelineDeploymentProgress from './PipelineDeploymentProgress'
import { PipelineNotFound } from '../PipelineNotFound'
import { useStore } from '@/src/store'
import type { Pipeline, ApiError } from '@/src/types/pipeline'

interface PipelineDetailsClientWrapperProps {
  pipelineId: string
}

export default function PipelineDetailsClientWrapper({ pipelineId }: PipelineDetailsClientWrapperProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPipelineNotFound, setIsPipelineNotFound] = useState(false)
  const [showDeploymentProgress, setShowDeploymentProgress] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const isDeploymentMode = searchParams?.get('deployment') === 'progress'

  // Get pipeline name from store if available (from recent pipeline creation)
  const { coreStore } = useStore()
  const { pipelineName } = coreStore

  useEffect(() => {
    // Set deployment progress mode if URL parameter is present
    if (isDeploymentMode) {
      setShowDeploymentProgress(true)
      setLoading(false) // Don't need to load pipeline data for deployment progress
      return
    }

    const fetchPipeline = async () => {
      try {
        setLoading(true)
        setError(null)
        setIsPipelineNotFound(false)
        const data = await getPipeline(pipelineId)
        setPipeline(data)
      } catch (err: any) {
        console.error('Failed to fetch pipeline:', err)

        // Check if this is a 404 error (pipeline not found)
        const apiError = err as ApiError
        if (apiError?.code === 404) {
          setIsPipelineNotFound(true)
        } else {
          setError(err.message || 'Failed to fetch pipeline')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchPipeline()
  }, [pipelineId, isDeploymentMode])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pipeline details...</p>
        </div>
      </div>
    )
  }

  if (isPipelineNotFound) {
    return <PipelineNotFound pipelineId={pipelineId} />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Handle deployment progress mode
  const handleDeploymentComplete = () => {
    setShowDeploymentProgress(false)
    // Remove deployment query parameter and refresh pipeline data
    router.replace(`/pipelines/${pipelineId}`)

    // Fetch the pipeline data now that deployment is complete
    const fetchPipeline = async () => {
      try {
        setLoading(true)
        setError(null)
        setIsPipelineNotFound(false)
        const data = await getPipeline(pipelineId)
        setPipeline(data)
      } catch (err: any) {
        console.error('Failed to fetch pipeline after deployment:', err)

        // Check if this is a 404 error (pipeline not found)
        const apiError = err as ApiError
        if (apiError?.code === 404) {
          setIsPipelineNotFound(true)
        } else {
          setError(err.message || 'Failed to fetch pipeline')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchPipeline()
  }

  const handleDeploymentFailed = (error: string) => {
    console.error('Pipeline deployment failed:', error)
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
          <div className="text-gray-500 text-lg font-semibold mb-2">Pipeline Not Found</div>
          <p className="text-gray-600">Pipeline with ID &quot;{pipelineId}&quot; could not be found.</p>
        </div>
      </div>
    )
  }

  return <PipelineDetailsModule pipeline={pipeline} />
}
