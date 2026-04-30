'use client'

import * as React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartFrame, type ChartFrameState } from './ChartFrame'
import type { MetricResult } from '@/src/hooks/useMetricsQuery'
import { useStore } from '@/src/store'

type ChartCardProps = {
  title: string
  query: string
  data: MetricResult | undefined
  error?: Error
  loading: boolean
  height?: number
  enableBrush?: boolean
}

export function ChartCard({
  title,
  query,
  data,
  error,
  loading,
  height = 180,
  enableBrush = true,
}: ChartCardProps) {
  const { observabilityStore } = useStore()
  const series = data?.result?.result?.[0]?.values ?? []
  const points = React.useMemo(
    () => series.map((p) => ({ t: p[0] * 1000, v: parseFloat(p[1]) })),
    [series],
  )
  const state: ChartFrameState = loading
    ? 'loading'
    : error
      ? 'error'
      : points.length === 0
        ? 'empty'
        : 'populated'

  // Brush selection state (drag to pin a range).
  const [brushStart, setBrushStart] = React.useState<number | null>(null)
  const [brushEnd, setBrushEnd] = React.useState<number | null>(null)

  return (
    <ChartFrame
      title={title}
      subline={<span title={query}>{query.length > 64 ? `${query.slice(0, 64)}…` : query}</span>}
      state={state}
      errorMessage={error?.message}
      height={height}
    >
      <ResponsiveContainer>
        <LineChart
          data={points}
          margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
          onMouseDown={(e: { activeLabel?: number | string } | null) => {
            if (!enableBrush) return
            if (e?.activeLabel != null) setBrushStart(Number(e.activeLabel))
          }}
          onMouseMove={(e: { activeLabel?: number | string } | null) => {
            if (!enableBrush) return
            if (brushStart != null && e?.activeLabel != null) {
              setBrushEnd(Number(e.activeLabel))
            }
          }}
          onMouseUp={() => {
            if (
              enableBrush &&
              brushStart != null &&
              brushEnd != null &&
              brushStart !== brushEnd
            ) {
              const fromMs = Math.min(brushStart, brushEnd)
              const toMs = Math.max(brushStart, brushEnd)
              observabilityStore.pinBrushedRange({ fromMs, toMs }, 'metrics_drill_down')
            }
            setBrushStart(null)
            setBrushEnd(null)
          }}
          onMouseLeave={() => {
            setBrushStart(null)
            setBrushEnd(null)
          }}
        >
          <CartesianGrid stroke="var(--obs-chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tick={{
              fill: 'var(--obs-chart-axis)',
              fontSize: 10,
              fontFamily: 'var(--font-family-mono)',
            }}
            tickFormatter={(t: number) => new Date(t).toLocaleTimeString()}
          />
          <YAxis
            tick={{
              fill: 'var(--obs-chart-axis)',
              fontSize: 10,
              fontFamily: 'var(--font-family-mono)',
            }}
            width={36}
          />
          <Tooltip
            labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
            contentStyle={{
              background: 'var(--color-background-elevation-overlay)',
              border: '1px solid var(--surface-border)',
            }}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke="var(--color-foreground-primary)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {brushStart != null && brushEnd != null && (
            <ReferenceArea
              x1={brushStart}
              x2={brushEnd}
              fill="var(--color-foreground-primary)"
              fillOpacity={0.15}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
