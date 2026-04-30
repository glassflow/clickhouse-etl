'use client'

import { Crumbs } from '@/src/components/ui/crumbs'
import { Badge } from '@/src/components/ui/badge'
import { LiveIndicator } from '@/src/components/ui/live-indicator'
import type { Pipeline } from '@/src/types/pipeline'

type PipelineHeaderProps = {
  pipeline: Pipeline
  driftCount?: number
}

export function PipelineHeader({ pipeline, driftCount }: PipelineHeaderProps) {
  const status = pipeline.status?.toLowerCase() ?? 'unknown'
  const isLive = status === 'running' || status === 'active'

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
            <Badge variant="warning">{driftCount} drift</Badge>
          )}
        </div>
        <span className="mono-2 text-[var(--text-tertiary)]">{pipeline.pipeline_id}</span>
      </div>
    </div>
  )
}
