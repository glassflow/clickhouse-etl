'use client'

import * as React from 'react'
import { Sparkline } from '@/src/components/ui/sparkline'
import { ChartFrame, type ChartFrameState } from './ChartFrame'
import type { MetricResult } from '@/src/hooks/useMetricsQuery'

type HeroCardProps = {
  title: string
  data: MetricResult | undefined
  error?: Error
  loading: boolean
  format?: (n: number) => string
  unit?: string
}

const defaultFormat = (n: number) => n.toFixed(2)

export function HeroCard({
  title,
  data,
  error,
  loading,
  format = defaultFormat,
  unit,
}: HeroCardProps) {
  const series = data?.result?.result?.[0]?.values ?? []
  const numerics = series
    .map((p) => parseFloat(p[1]))
    .filter((n) => Number.isFinite(n))
  const current = numerics.at(-1)
  const previous = numerics[Math.floor(numerics.length / 2)]
  const delta =
    current != null && previous != null && previous !== 0
      ? ((current - previous) / previous) * 100
      : null

  const state: ChartFrameState = loading
    ? 'loading'
    : error
      ? 'error'
      : numerics.length === 0
        ? 'empty'
        : 'populated'

  return (
    <ChartFrame title={title} state={state} errorMessage={error?.message} height={64}>
      <div className="flex items-end justify-between h-full">
        <div className="flex flex-col">
          <span className="title-3 mono-1 text-[var(--text-primary)]">
            {current != null ? format(current) : '—'}
            {unit && (
              <span className="caption-1 text-[var(--text-tertiary)] ml-1">{unit}</span>
            )}
          </span>
          {delta != null && (
            <span
              className={
                delta >= 0
                  ? 'caption-1 mono-2 text-[var(--color-foreground-positive)]'
                  : 'caption-1 mono-2 text-[var(--color-foreground-critical)]'
              }
            >
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
          )}
        </div>
        <Sparkline data={numerics} width={120} height={36} />
      </div>
    </ChartFrame>
  )
}
