'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartFrame, type ChartFrameState } from './ChartFrame'
import { MetricsToolbar } from './MetricsToolbar'
import { useMetricsQuery } from '@/src/hooks/useMetricsQuery'
import type { CanonicalQueryKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'
import { Button } from '@/src/components/ui/button'

type DrillDownViewProps = {
  pipelineId: string
  queryKey: CanonicalQueryKey
}

const COMPONENT_COLORS: Record<string, string> = {
  ingestor: 'var(--obs-chart-ingestor)',
  processor: 'var(--obs-chart-processor)',
  sink: 'var(--obs-chart-sink)',
}

export function DrillDownView({ pipelineId, queryKey }: DrillDownViewProps) {
  const { data, error, isLoading } = useMetricsQuery(pipelineId, queryKey)
  const series = data?.result?.result ?? []

  const { points, components } = React.useMemo(() => {
    // Pivot: timestamps × component
    const allTimestamps = new Set<number>()
    for (const s of series) for (const v of s.values) allTimestamps.add(v[0])
    const ts = Array.from(allTimestamps).sort((a, b) => a - b)
    const rows = ts.map((t) => {
      const row: Record<string, number | undefined> = { t: t * 1000 }
      for (const s of series) {
        const comp = s.metric.component ?? 'all'
        const found = s.values.find((v) => v[0] === t)
        row[comp] = found ? parseFloat(found[1]) : undefined
      }
      return row
    })
    const comps = Array.from(new Set(series.map((s) => s.metric.component ?? 'all')))
    return { points: rows, components: comps }
  }, [series])

  const state: ChartFrameState = isLoading
    ? 'loading'
    : error
      ? 'error'
      : points.length === 0
        ? 'empty'
        : 'populated'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/pipelines/${pipelineId}/metrics`}
          className="caption-1 text-[var(--color-foreground-primary)] hover:underline"
        >
          ← back to metrics
        </Link>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/pipelines/${pipelineId}/logs`}>Open logs in range →</Link>
        </Button>
      </div>

      <MetricsToolbar pipelineId={pipelineId} />

      <ChartFrame title={queryKey} state={state} errorMessage={error?.message} height={420}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="var(--obs-chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              tick={{
                fill: 'var(--obs-chart-axis)',
                fontSize: 11,
                fontFamily: 'var(--font-family-mono)',
              }}
              tickFormatter={(t: number) => new Date(t).toLocaleTimeString()}
            />
            <YAxis
              tick={{
                fill: 'var(--obs-chart-axis)',
                fontSize: 11,
                fontFamily: 'var(--font-family-mono)',
              }}
            />
            <Tooltip
              labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
              contentStyle={{
                background: 'var(--color-background-elevation-overlay)',
                border: '1px solid var(--surface-border)',
              }}
            />
            <Legend />
            {components.map((c) => (
              <Line
                key={c}
                type="monotone"
                dataKey={c}
                stroke={COMPONENT_COLORS[c] ?? 'var(--color-foreground-primary)'}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  )
}
