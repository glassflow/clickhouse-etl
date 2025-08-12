'use client'

import { useEffect, useState } from 'react'
import { getPipeline } from '@/src/api/pipeline-api'
import PipelineDetailsModule from './PipelineDetailsModule'
import type { Pipeline } from '@/src/types/pipeline'

interface PipelineDetailsClientWrapperProps {
  pipelineId: string
}

export default function PipelineDetailsClientWrapper({ pipelineId }: PipelineDetailsClientWrapperProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getPipeline(pipelineId)
        setPipeline(data)
      } catch (err: any) {
        console.error('Failed to fetch pipeline:', err)
        setError(err.message || 'Failed to fetch pipeline')
      } finally {
        setLoading(false)
      }
    }

    fetchPipeline()
  }, [pipelineId])

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
