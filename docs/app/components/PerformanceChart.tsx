'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import rawData from '../architecture/performance/data.json'
import { BRAND_COLORS, CHART_THEME } from './theme'

type MetricKey = 'ingestor' | 'sink'

interface Props {
  metric: MetricKey
  title: string
}

const REPLICA_COLORS: Record<string, string> = {
  '2':  BRAND_COLORS.orange200,
  '4':  BRAND_COLORS.orange300,
  '6':  BRAND_COLORS.orange400,
  '8':  BRAND_COLORS.orange500,
  '10': BRAND_COLORS.orange600,
}

const REPLICAS = ['2', '4', '6', '8', '10'] as const

function formatRps(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

function CustomTooltip({ active, payload, label, colors }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <p style={{ marginBottom: 6, color: colors.tooltipLabel, fontWeight: 500 }}>
        {Number(label).toFixed(2)} min
      </p>
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
          <span style={{ color: colors.tooltipText }}>{entry.name}:</span>
          <span style={{ fontWeight: 600, color: colors.tooltipValue }}>{formatRps(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function PerformanceChart({ metric, title }: Props) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after client mount
  useEffect(() => { setMounted(true) }, [])

  const colors = mounted && resolvedTheme === 'dark' ? CHART_THEME.dark : CHART_THEME.light

  return (
    <div style={{ marginTop: 16, marginBottom: 24 }}>
      <p style={{ textAlign: 'center', fontWeight: 600, fontSize: 15, marginBottom: 12, color: 'inherit' }}>
        {title}
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
          <XAxis
            dataKey="minutes"
            type="number"
            domain={[0, 5]}
            tickCount={6}
            tickFormatter={(v) => `${v} min`}
            stroke={colors.axis}
            tick={{ fill: colors.tick, fontSize: 12 }}
            label={{ value: 'Time (minutes)', position: 'insideBottom', offset: -4, fill: colors.label, fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v) => v === 0 ? '' : formatRps(v)}
            stroke={colors.axis}
            tick={{ fill: colors.tick, fontSize: 12 }}
            width={48}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} colors={colors} />} />
          <Legend
            verticalAlign="top"
            align="right"
            content={({ payload }) => {
              if (!payload?.length) return null
              const sorted = [...payload].sort(
                (a, b) => parseInt(a.value) - parseInt(b.value)
              )
              return (
                <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: 12, flexWrap: 'wrap' }}>
                  {sorted.map((entry) => (
                    <span key={entry.value} style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.legendText }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color as string, display: 'inline-block' }} />
                      {entry.value}
                    </span>
                  ))}
                </div>
              )
            }}
          />
          {REPLICAS.map((r) => (
            <Line
              key={r}
              data={(rawData as any)[r]}
              dataKey={metric}
              name={`${r} replicas`}
              stroke={REPLICA_COLORS[r]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
