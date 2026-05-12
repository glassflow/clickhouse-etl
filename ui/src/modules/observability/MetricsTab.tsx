'use client'

import Link from 'next/link'
import { ChartCard } from './ChartCard'
import { HeroCard } from './HeroCard'
import { MetricsToolbar } from './MetricsToolbar'
import { ScopingNoteBanner } from './ScopingNoteBanner'
import { DisabledState } from './DisabledState'
import { CHART_GRID, HERO_CARDS, type ChartSpec } from './canonicalDashboard'
import { useMetricsQuery } from '@/src/hooks/useMetricsQuery'
import { useObservabilityFlag } from '@/src/hooks/useObservabilityFlag'
import { CANONICAL_QUERIES } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'

type MetricsTabProps = { pipelineId: string }

export function MetricsTab({ pipelineId }: MetricsTabProps) {
  const enabled = useObservabilityFlag()

  if (!enabled) {
    return <DisabledState surface="metrics" />
  }

  return (
    <div className="flex flex-col gap-4">
      <MetricsToolbar pipelineId={pipelineId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {HERO_CARDS.map((spec) => (
          <HeroCardSlot key={spec.key} pipelineId={pipelineId} spec={spec} />
        ))}
      </div>

      <ScopingNoteBanner pipelineId={pipelineId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CHART_GRID.map((spec) => (
          <Link
            key={spec.key}
            href={`/pipelines/${pipelineId}/metrics/${spec.key}`}
            className="block focus:outline-none focus:ring-2 focus:ring-[var(--color-foreground-primary)] rounded-md"
          >
            <ChartCardSlot pipelineId={pipelineId} spec={spec} />
          </Link>
        ))}
      </div>
    </div>
  )
}

function HeroCardSlot({ pipelineId, spec }: { pipelineId: string; spec: ChartSpec }) {
  const { data, error, isLoading } = useMetricsQuery(pipelineId, spec.key)
  return <HeroCard title={spec.title} unit={spec.unit} data={data} error={error} loading={isLoading} />
}

function ChartCardSlot({ pipelineId: _pipelineId, spec }: { pipelineId: string; spec: ChartSpec }) {
  const { data, error, isLoading } = useMetricsQuery(_pipelineId, spec.key)
  return (
    <ChartCard title={spec.title} query={CANONICAL_QUERIES[spec.key]} data={data} error={error} loading={isLoading} />
  )
}
