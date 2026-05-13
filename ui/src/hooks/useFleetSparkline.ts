'use client'

import { useEffect, useState } from 'react'
import type { CanonicalQueryKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'

export type FleetSparklineState = {
  values: number[]
  latest: number | null
  isLoading: boolean
  error: Error | undefined
}

export function useFleetSparkline(
  pipelineId: string,
  queryName: CanonicalQueryKey,
  fromMs: number,
  toMs: number,
  step: string,
  autoRefreshIntervalMs: number | null,
): FleetSparklineState {
  const [values, setValues] = useState<number[]>([])
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!pipelineId) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setIsLoading(true)
    setError(undefined)

    const url = `/ui-api/pipelines/${pipelineId}/metrics?query=${queryName}&from=${fromMs}&to=${toMs}&step=${step}`

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            const body = await res.json()
            if (body?.error) msg = body.error
          } catch {
            /* ignore */
          }
          throw new Error(msg)
        }
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        const raw: Array<[number, string]> = json?.result?.result?.[0]?.values ?? []
        setValues(raw.map(([, v]) => parseFloat(v)).filter((n) => Number.isFinite(n)))
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setValues([])
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [pipelineId, queryName, fromMs, toMs, step, tick])

  useEffect(() => {
    if (!autoRefreshIntervalMs || !pipelineId) return
    const id = setInterval(() => setTick((t) => t + 1), autoRefreshIntervalMs)
    return () => clearInterval(id)
  }, [autoRefreshIntervalMs, pipelineId])

  const latest = values.length > 0 ? values[values.length - 1] : null

  return { values, latest, isLoading, error }
}
