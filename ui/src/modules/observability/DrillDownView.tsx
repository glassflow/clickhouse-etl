'use client'

import * as React from 'react'
import Link from 'next/link'
import { OBChartSVG, type OBSeries } from './primitives/OBChartSVG'
import { ChartFrame, type ChartFrameState } from './ChartFrame'
import { MetricsToolbar } from './MetricsToolbar'
import { useMetricsQuery, type MetricSeries } from '@/src/hooks/useMetricsQuery'
import type { CanonicalQueryKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'

const COMPONENT_COLORS: Record<string, string> = {
  ingestor: 'var(--obs-chart-ingestor)',
  processor: 'var(--obs-chart-processor)',
  sink: 'var(--obs-chart-sink)',
}
const FALLBACK_COLOR = 'var(--color-foreground-primary)'
const EMPTY_RAW: MetricSeries[] = []

type DrillDownViewProps = {
  pipelineId: string
  queryKey: CanonicalQueryKey
}

export function DrillDownView({ pipelineId, queryKey }: DrillDownViewProps) {
  const { observabilityStore } = useStore()
  const { data, error, isLoading } = useMetricsQuery(pipelineId, queryKey)
  const rawSeries = data?.result?.result ?? EMPTY_RAW

  const obSeries: OBSeries[] = React.useMemo(
    () =>
      rawSeries.map((s) => {
        const comp = (s.metric.component ?? 'all') as string
        return {
          id: comp,
          color: COMPONENT_COLORS[comp] ?? FALLBACK_COLOR,
          points: s.values.map(([t, v]) => [t * 1000, parseFloat(v)] as [number, number]),
        }
      }),
    [rawSeries],
  )

  const state: ChartFrameState = isLoading ? 'loading' : error ? 'error' : obSeries.length === 0 ? 'empty' : 'populated'

  const brushed = observabilityStore.brushedRange

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/pipelines/${pipelineId}/metrics`}
          className="caption-1 text-[var(--color-foreground-primary)] hover:underline"
        >
          ← back to metrics
        </Link>
        <div className="flex items-center gap-2">
          {brushed && (
            <Button variant="ghost" size="sm" onClick={() => observabilityStore.clearBrushedRange()}>
              Clear brush
            </Button>
          )}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/pipelines/${pipelineId}/logs`}>Open logs in range →</Link>
          </Button>
        </div>
      </div>

      <MetricsToolbar pipelineId={pipelineId} />

      <ChartFrame title={queryKey} state={state} errorMessage={error?.message} height={420}>
        <div className="w-full h-full">
          <OBChartSVG
            series={obSeries}
            width={1580}
            height={400}
            showCrosshair
            showBrush
            brushFromMs={brushed?.fromMs ?? null}
            brushToMs={brushed?.toMs ?? null}
            onBrushChange={(fromMs, toMs) => observabilityStore.pinBrushedRange({ fromMs, toMs }, 'metrics_drill_down')}
            onBrushClear={() => observabilityStore.clearBrushedRange()}
          />
        </div>
      </ChartFrame>
    </div>
  )
}
