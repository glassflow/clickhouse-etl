'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import rawData from '../architecture/performance/data.json'
import { SERIES_COLORS, CHART_THEME } from './theme'

type MetricKey = 'ingestor' | 'sink'

interface Props {
  metric: MetricKey
  title: string
}

const REPLICA_COLORS: Record<string, string> = {
  '2':  SERIES_COLORS.blue400,
  '4':  SERIES_COLORS.purple,
  '6':  SERIES_COLORS.orange,
  '8':  SERIES_COLORS.yellow500,
  '10': SERIES_COLORS.red500,
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
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
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

  useEffect(() => { setMounted(true) }, [])

  const colors = mounted && resolvedTheme === 'dark' ? CHART_THEME.dark : CHART_THEME.light

  return (
    <div
      style={{
        marginTop: 16,
        marginBottom: 24,
        background: colors.cardBg,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 12,
        padding: '20px 16px 12px',
      }}
    >
      <p style={{ textAlign: 'center', fontWeight: 600, fontSize: 15, marginBottom: 12, color: 'inherit' }}>
        {title}
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <defs>
            {REPLICAS.map((r) => (
              <linearGradient key={r} id={`grad-${metric}-${r}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={REPLICA_COLORS[r]} stopOpacity={0.2} />
                <stop offset="95%" stopColor={REPLICA_COLORS[r]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
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
                <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: 12, flexWrap: 'wrap', marginBottom: 8 }}>
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
            <Area
              key={r}
              data={(rawData as any)[r]}
              dataKey={metric}
              name={`${r} replicas`}
              stroke={REPLICA_COLORS[r]}
              strokeWidth={1.5}
              fill={`url(#grad-${metric}-${r})`}
              type="monotone"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
