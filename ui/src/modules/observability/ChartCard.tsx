'use client'

import * as React from 'react'
import {
  CartesianGrid,
  Legend,
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
  /**
   * Optional component allow-list. When set and non-empty, only series whose
   * `metric.component` label is included will be rendered. Series without a
   * `component` label (single-series fallback) are unaffected.
   */
  selectedComponents?: string[]
}

const COMPONENT_COLORS: Record<string, string> = {
  ingestor: 'var(--obs-chart-ingestor)',
  processor: 'var(--obs-chart-processor)',
  sink: 'var(--obs-chart-sink)',
}

const FALLBACK_COLOR = 'var(--color-foreground-primary)'
const FALLBACK_KEY = 'all'

function colorFor(component: string): string {
  return COMPONENT_COLORS[component] ?? FALLBACK_COLOR
}

export function ChartCard({
  title,
  query,
  data,
  error,
  loading,
  height = 180,
  enableBrush = true,
  selectedComponents,
}: ChartCardProps) {
  const { observabilityStore } = useStore()

  const seriesArray = data?.result?.result ?? []

  // Pivot a series-per-component response into a flat array of timestamp-keyed
  // rows that Recharts can consume. Each row looks like
  //   { t: <ms>, ingestor: <num>, processor: <num>, sink: <num> }
  // and we render one <Line> per discovered component key.
  const { rows, components } = React.useMemo(() => {
    if (seriesArray.length === 0) {
      return { rows: [] as Array<Record<string, number>>, components: [] as string[] }
    }

    // Discover component keys in input order, then optionally narrow by the
    // allow-list. Series without a `component` label collapse onto a single
    // fallback key ("all").
    const discovered: string[] = []
    const seen = new Set<string>()
    for (const s of seriesArray) {
      const key = s.metric?.component ?? FALLBACK_KEY
      if (!seen.has(key)) {
        seen.add(key)
        discovered.push(key)
      }
    }

    // Only apply the allow-list filter when (a) the caller passed a non-empty
    // list AND (b) the data actually has labeled components. If everything is
    // unlabeled we render the fallback regardless.
    const hasLabeledComponents = discovered.some((k) => k !== FALLBACK_KEY)
    const filtered =
      selectedComponents && selectedComponents.length > 0 && hasLabeledComponents
        ? discovered.filter((k) => k === FALLBACK_KEY || selectedComponents.includes(k))
        : discovered

    // Build a sparse map keyed by timestamp so we can merge across series.
    const byT = new Map<number, Record<string, number>>()
    for (const s of seriesArray) {
      const key = s.metric?.component ?? FALLBACK_KEY
      if (!filtered.includes(key)) continue
      for (const [tSec, vStr] of s.values) {
        const tMs = tSec * 1000
        const v = parseFloat(vStr)
        if (Number.isNaN(v)) continue
        const row = byT.get(tMs) ?? { t: tMs }
        row[key] = v
        byT.set(tMs, row)
      }
    }

    const merged = Array.from(byT.values()).sort((a, b) => (a.t as number) - (b.t as number))
    return { rows: merged, components: filtered }
  }, [seriesArray, selectedComponents])

  const state: ChartFrameState = loading ? 'loading' : error ? 'error' : rows.length === 0 ? 'empty' : 'populated'

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
          data={rows}
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
            if (enableBrush && brushStart != null && brushEnd != null && brushStart !== brushEnd) {
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
          {components.length > 1 && (
            <Legend
              wrapperStyle={{
                fontSize: 10,
                fontFamily: 'var(--font-family-mono)',
                color: 'var(--obs-chart-axis)',
              }}
            />
          )}
          {components.map((c) => (
            <Line
              key={c}
              type="monotone"
              dataKey={c}
              name={c}
              stroke={colorFor(c)}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
          {brushStart != null && brushEnd != null && (
            <ReferenceArea x1={brushStart} x2={brushEnd} fill="var(--color-foreground-primary)" fillOpacity={0.15} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
