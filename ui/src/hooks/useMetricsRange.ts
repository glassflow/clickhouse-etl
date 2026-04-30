'use client'

import { useStore } from '@/src/store'
import type { TimeRangeKey } from '@/src/components/ui/time-range-picker'

const RANGE_MS: Record<Exclude<TimeRangeKey, 'custom'>, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
}

export type MetricsRange = {
  fromMs: number
  toMs: number
  step: string
  isAnchoredNow: boolean
}

/**
 * Resolve the current metrics time range.
 *
 * Priority (highest first):
 *   1. brushed range pinned in observability store (e.g. from drill-down)
 *   2. custom absolute range (rangeKey === 'custom')
 *   3. relative range key keyed off `Date.now()`
 *
 * `isAnchoredNow` is true only for the relative-key case — it gates auto-refresh
 * (don't poll a frozen brushed/custom range).
 */
export function useMetricsRange(): MetricsRange {
  const { observabilityStore } = useStore()
  const { rangeKey, customRange, brushedRange } = observabilityStore

  if (brushedRange) {
    return {
      fromMs: brushedRange.fromMs,
      toMs: brushedRange.toMs,
      step: pickStep(brushedRange.toMs - brushedRange.fromMs),
      isAnchoredNow: false,
    }
  }
  if (rangeKey === 'custom' && customRange) {
    return {
      fromMs: customRange.fromMs,
      toMs: customRange.toMs,
      step: pickStep(customRange.toMs - customRange.fromMs),
      isAnchoredNow: false,
    }
  }
  const ms = RANGE_MS[rangeKey as Exclude<TimeRangeKey, 'custom'>] ?? RANGE_MS['1h']
  // Round toMs to a 30-second bucket so consecutive renders within the same
  // bucket produce the same URL (and don't refetch). The poll loop bumps a
  // separate `tick` to drive refresh.
  const toMs = Math.floor(Date.now() / 30_000) * 30_000
  return { fromMs: toMs - ms, toMs, step: pickStep(ms), isAnchoredNow: true }
}

function pickStep(durationMs: number): string {
  if (durationMs <= 60 * 60_000) return '15s'
  if (durationMs <= 6 * 60 * 60_000) return '60s'
  if (durationMs <= 24 * 60 * 60_000) return '5m'
  return '30m'
}
