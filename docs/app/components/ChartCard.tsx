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
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import { CHART_THEME } from './theme'

export interface ChartSeries {
  dataKey: string
  label: string
  color: string
}

interface Props {
  title: string
  data: object[]
  series: ChartSeries[]
  xKey: string
  xLabel?: string
  yFormatter?: (value: number) => string
  showPointLabels?: boolean
  showLegend?: boolean
}

function defaultYFormatter(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

function CustomTooltip({ active, payload, label, colors, yFormatter, xLabel }: any) {
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
        {xLabel ? `${xLabel}: ` : ''}{label}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
          <span style={{ color: colors.tooltipText }}>{entry.name}:</span>
          <span style={{ fontWeight: 600, color: colors.tooltipValue }}>{yFormatter(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function ChartCard({ title, data, series, xKey, xLabel, yFormatter, showPointLabels, showLegend = true }: Props) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const colors = mounted && resolvedTheme === 'dark' ? CHART_THEME.dark : CHART_THEME.light
  const fmt = yFormatter ?? defaultYFormatter

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
        <AreaChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.dataKey} id={`grad-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke={colors.axis}
            tick={{ fill: colors.tick, fontSize: 12 }}
            label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -4, fill: colors.label, fontSize: 12 } : undefined}
          />
          <YAxis
            tickFormatter={(v) => v === 0 ? '' : fmt(v)}
            stroke={colors.axis}
            tick={{ fill: colors.tick, fontSize: 12 }}
            width={48}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} colors={colors} yFormatter={fmt} xLabel={xLabel} />} />
          {showLegend && (
            <Legend
              verticalAlign="top"
              align="right"
              content={({ payload }) => {
                if (!payload?.length) return null
                return (
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    {payload.map((entry) => (
                      <span key={entry.value} style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.legendText }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color as string, display: 'inline-block' }} />
                        {entry.value}
                      </span>
                    ))}
                  </div>
                )
              }}
            />
          )}
          {series.map((s) => (
            <Area
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.label}
              stroke={s.color}
              strokeWidth={1.5}
              fill={`url(#grad-${s.dataKey})`}
              type="monotone"
              dot={{ r: 4, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            >
              {showPointLabels && (
                <LabelList
                  dataKey={s.dataKey}
                  position="top"
                  formatter={fmt}
                  style={{ fill: s.color, fontSize: 11, fontWeight: 600 }}
                />
              )}
            </Area>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
