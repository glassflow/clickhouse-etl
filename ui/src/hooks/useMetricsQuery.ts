'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { useMetricsRange } from './useMetricsRange'
import type { CanonicalQueryKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'

export type MetricSeries = {
  metric: Record<string, string>
  values: Array<[number, string]>
}

export type MetricResult = {
  promql: string
  query: string
  result: { resultType: string; result: MetricSeries[] }
}

type FetchState = {
  data: MetricResult | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: () => void
}

const REFRESH_MS = 30_000

/**
 * Fetch a canonical metric query for a given pipeline.
 *
 * Mirrors the `useDetailFetch` pattern used by the Library hooks: cancellable
 * fetch on URL change, plus an auto-refresh tick that fires every 30s when
 * the time range is "now"-anchored and `observabilityStore.autoRefresh` is on.
 */
export function useMetricsQuery(
  pipelineId: string,
  queryName: CanonicalQueryKey,
): FetchState {
  const { fromMs, toMs, step, isAnchoredNow } = useMetricsRange()
  const { observabilityStore } = useStore()
  const polling = observabilityStore.autoRefresh && isAnchoredNow

  const [data, setData] = useState<MetricResult | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)

  // Build a URL that's stable enough to drive useEffect, even when toMs floats.
  // For polling, we explicitly bump `tick` every 30s; we don't want each render
  // to refetch just because Date.now() changed.
  const url = `/ui-api/pipelines/${pipelineId}/metrics?query=${queryName}&from=${fromMs}&to=${toMs}&step=${step}`

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(undefined)

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            const body = await res.json()
            if (body?.error) msg = body.error
          } catch {
            /* ignore body parse errors */
          }
          throw new Error(msg)
        }
        return (await res.json()) as MetricResult
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick])

  // Poll: bump `tick` every REFRESH_MS while anchored-now + auto-refresh enabled.
  useEffect(() => {
    if (!polling) return
    const i = setInterval(() => setTick((t) => t + 1), REFRESH_MS)
    return () => clearInterval(i)
  }, [polling])

  const mutate = () => setTick((t) => t + 1)

  return { data, error, isLoading, mutate }
}
