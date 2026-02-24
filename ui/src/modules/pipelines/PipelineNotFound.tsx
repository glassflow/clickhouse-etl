'use client'

import React, { useEffect } from 'react'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

interface PipelineNotFoundProps {
  pipelineId: string
}

export function PipelineNotFound({ pipelineId }: PipelineNotFoundProps) {
  const analytics = useJourneyAnalytics()
  const router = useRouter()

  // Track page view when component loads
  useEffect(() => {
    analytics.page.pipelines({})
  }, [analytics])

  const handleBackToPipelines = () => {
    router.push('/pipelines')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Pipeline not found</h2>
        <p className="text-sm text-content">
          Pipeline with ID <span className="font-mono bg-muted px-2 py-1 rounded">{pipelineId}</span> does not exist or
          has been deleted.
        </p>
      </div>

      <Button variant="primary" size="custom" className="flex items-center gap-2" onClick={handleBackToPipelines}>
        ← Back to Pipelines
      </Button>
    </div>
  )
}
