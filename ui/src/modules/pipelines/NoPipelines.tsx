'use client'

import React, { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export function NoPipelines() {
  const analytics = useJourneyAnalytics()
  const router = useRouter()

  useEffect(() => {
    analytics.page.pipelines({})
  }, [])

  const handleCreatePipeline = () => {
    router.push('/home')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-8">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">
        <h2 className="title-4 text-[var(--color-foreground-neutral)]">No pipelines yet</h2>
        <p className="body-3 text-[var(--color-foreground-neutral-faded)]">
          A pipeline connects your data source (Kafka or OpenTelemetry) to ClickHouse — filtering, transforming, and deduplicating events along the way.
        </p>
        <a
          href="https://docs.glassflow.dev/"
          target="_blank"
          rel="noopener"
          className="caption-1 text-[var(--color-foreground-primary)] hover:underline"
        >
          Read the docs →
        </a>
      </div>

      <Button variant="primary" size="default" onClick={handleCreatePipeline}>
        <Plus className="h-4 w-4" />
        Create your first pipeline
      </Button>
    </div>
  )
}
