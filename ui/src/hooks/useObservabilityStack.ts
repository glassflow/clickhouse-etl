'use client'

import { useEffect, useState } from 'react'

export type ObservabilityStack = {
  vmsingle: {
    version: string | null
    retention: string
    diskUsageBytes: number | null
    diskQuotaBytes: number | null
  }
  victoriaLogs: {
    version: string | null
    retention: string
    diskUsageBytes: number | null
    diskQuotaBytes: number | null
  }
  fanOut: {
    collectorEndpoint: string | null
    external: Array<{ name: string; url: string }>
  }
  cardinality: Array<{ label: string; value: number | null }>
}

const REFRESH_INTERVAL_MS = 60_000
const STACK_URL = '/ui-api/observability/stack'

/**
 * Fetches the observability stack admin payload for the workspace panel.
 *
 * Mirrors the `useDetailFetch` pattern from `useLibraryDetail.ts` (no SWR
 * dependency — keeps the hook surface consistent with the rest of the
 * codebase). Auto-refreshes every 60s while mounted.
 */
export function useObservabilityStack() {
  const [data, setData] = useState<ObservabilityStack | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    if (data == null) setIsLoading(true)

    fetch(STACK_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ObservabilityStack>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setIsLoading(false)
        }
      })

    const refreshTimer = setInterval(() => {
      if (!cancelled) setTick((t) => t + 1)
    }, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(refreshTimer)
    }
    // `data` intentionally omitted; including it would cause a fetch storm.
    // The tick re-runs the effect on the refresh cadence; loading state is
    // suppressed for refreshes (only initial load shows the skeleton).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const mutate = () => setTick((t) => t + 1)

  return {
    data,
    error: error ?? undefined,
    isLoading,
    mutate,
  }
}
