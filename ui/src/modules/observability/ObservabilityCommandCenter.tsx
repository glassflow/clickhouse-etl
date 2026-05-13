'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getPipelines } from '@/src/api/pipeline-api'
import { cn } from '@/src/utils/common.client'
import { ObservabilityStatCards } from './ObservabilityStatCards'
import { ObservabilityFleetTable } from './ObservabilityFleetTable'
import { isDegraded, isPaused } from './pipeline-health'
import type { ListPipelineConfig } from '@/src/types/pipeline'

type TimeRange = '15m' | '1h' | '6h' | '24h'
type StatusFilter = 'all' | 'active' | 'degraded' | 'paused'

const RANGE_MS: Record<TimeRange, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
}

const STEP: Record<TimeRange, string> = {
  '15m': '15s',
  '1h': '15s',
  '6h': '60s',
  '24h': '5m',
}

const TIME_RANGE_OPTIONS: TimeRange[] = ['15m', '1h', '6h', '24h']
const AUTO_REFRESH_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'off', value: null },
  { label: '30s', value: 30_000 },
  { label: '60s', value: 60_000 },
]

function computeRange(tr: TimeRange): { fromMs: number; toMs: number; step: string } {
  const toMs = Math.floor(Date.now() / 30_000) * 30_000
  return { fromMs: toMs - RANGE_MS[tr], toMs, step: STEP[tr] }
}

export function ObservabilityCommandCenter() {
  const [pipelines, setPipelines] = useState<ListPipelineConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | null>(30_000)
  const [tick, setTick] = useState(0)
  const genRef = useRef(0)

  const load = useCallback(() => {
    setError(null)
    const gen = ++genRef.current
    getPipelines()
      .then((data) => {
        if (gen === genRef.current) setPipelines(data)
      })
      .catch(() => {
        if (gen === genRef.current) setError('Failed to load pipeline data')
      })
      .finally(() => {
        if (gen === genRef.current) setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    if (!autoRefreshInterval) return
    const id = setInterval(() => setTick((t) => t + 1), autoRefreshInterval)
    return () => clearInterval(id)
  }, [autoRefreshInterval])

  const { fromMs, toMs, step } = computeRange(timeRange)

  const filteredPipelines =
    statusFilter === 'all'
      ? pipelines
      : statusFilter === 'active'
        ? pipelines.filter((p) => p.status === 'active')
        : statusFilter === 'degraded'
          ? pipelines.filter(isDegraded)
          : pipelines.filter(isPaused)

  const counts = {
    all: pipelines.length,
    active: pipelines.filter((p) => p.status === 'active').length,
    degraded: pipelines.filter(isDegraded).length,
    paused: pipelines.filter(isPaused).length,
  }

  const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'active', label: `Active (${counts.active})` },
    { key: 'degraded', label: `Degraded (${counts.degraded})` },
    { key: 'paused', label: `Paused (${counts.paused})` },
  ]

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex flex-col gap-1">
        <h1 className="title-2 text-[var(--text-primary)]">Observability</h1>
        <p className="body-3 text-[var(--text-secondary)]">Fleet health and triage across all running pipelines</p>
      </div>

      {!isLoading && !error && <ObservabilityStatCards pipelines={pipelines} />}

      <div className="flex items-center gap-3 flex-wrap">
        {!isLoading && !error && (
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  'caption-1 px-3 py-1 rounded-full border transition-colors',
                  statusFilter === key
                    ? 'border-[var(--color-foreground-primary)] text-[var(--color-foreground-primary)] bg-[var(--color-background-primary-faded)]'
                    : 'border-[var(--surface-border)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <div className="flex gap-0.5 bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-lg p-0.5">
          {TIME_RANGE_OPTIONS.map((tr) => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              aria-label={tr}
              className={cn(
                'caption-1 px-3 py-1 rounded-md transition-colors',
                timeRange === tr
                  ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              )}
            >
              {tr}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="caption-1 text-[var(--text-tertiary)]">Refresh:</span>
          <div className="flex gap-0.5 bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-lg p-0.5">
            {AUTO_REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setAutoRefreshInterval(opt.value)}
                className={cn(
                  'caption-1 px-2.5 py-1 rounded-md transition-colors',
                  autoRefreshInterval === opt.value
                    ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center min-h-[30vh]">
          <span className="caption-1 text-[var(--text-secondary)]">Loading…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center min-h-[30vh]">
          <p className="body-3 text-[var(--color-foreground-critical)]">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <ObservabilityFleetTable
          pipelines={filteredPipelines}
          fromMs={fromMs}
          toMs={toMs}
          step={step}
          autoRefreshIntervalMs={autoRefreshInterval}
        />
      )}
    </div>
  )
}
