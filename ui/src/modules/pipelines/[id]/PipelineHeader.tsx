'use client'

import * as React from 'react'
import Link from 'next/link'
import { Crumbs } from '@/src/components/ui/crumbs'
import { Badge } from '@/src/components/ui/badge'
import { LiveIndicator } from '@/src/components/ui/live-indicator'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { SparklesIcon } from 'lucide-react'
import type { Pipeline } from '@/src/types/pipeline'

type PipelineHeaderProps = {
  pipeline: Pipeline
  driftCount?: number
}

export function PipelineHeader({ pipeline, driftCount }: PipelineHeaderProps) {
  const status = pipeline.status?.toLowerCase() ?? 'unknown'
  const isLive = status === 'running' || status === 'active'

  const { aiUiStore } = useStore()
  const setScope = aiUiStore.setScope
  const openDrawer = aiUiStore.openDrawer
  const pipelineId = pipeline.pipeline_id

  // Sync drawer scope with the currently-viewed pipeline so the per-pipeline
  // transcript is what loads when the user opens the drawer.
  React.useEffect(() => {
    setScope({ kind: 'pipeline', pipelineId })
  }, [pipelineId, setScope])

  return (
    <div className="flex flex-col gap-3">
      <Crumbs
        crumbs={[
          { label: 'Pipelines', href: '/pipelines' },
          { label: pipeline.name ?? pipeline.pipeline_id },
        ]}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="title-3 text-[var(--text-primary)]">
            {pipeline.name ?? pipeline.pipeline_id}
          </h1>
          <LiveIndicator active={isLive} label={status} />
          {driftCount != null && driftCount > 0 && (
            <Link
              href={`/pipelines/${pipeline.pipeline_id}/library-links`}
              aria-label={`${driftCount} library drift — open Library links`}
            >
              <Badge variant="warning" className="cursor-pointer hover:opacity-80">
                {driftCount} drift
              </Badge>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDrawer({ kind: 'pipeline', pipelineId })}
            aria-label="Resume AI chat for this pipeline"
          >
            <SparklesIcon size={14} className="mr-1.5" />
            Resume chat
          </Button>
          <span className="mono-2 text-[var(--text-tertiary)]">{pipeline.pipeline_id}</span>
        </div>
      </div>
    </div>
  )
}
