'use client'

import { useEffect, useState } from 'react'
import { useMetricsRange } from './useMetricsRange'

export type LogLine = {
  _time: string
  _stream_id?: string
  _msg: string
  pipeline_id?: string
  component?: string
  severity?: string
  trace_id?: string
  span_id?: string
  [k: string]: unknown
}

export type LogsResponse = { query: string; lines: LogLine[]; count: number }

type FetchState = {
  data: LogsResponse | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: () => void
}

/**
 * Range-mode logs fetcher.
 *
 * When the observability store has a brushed range pinned (or `skip` is
 * `false`), this hook fetches `/ui-api/pipelines/:id/logs?…` for the
 * resolved range. Mirrors the `useDetailFetch` pattern used by the Library
 * hooks: cancellable fetch on URL change, no SWR.
 */
export function useLogsQuery(
  pipelineId: string,
  query: string,
  opts?: { skip?: boolean; limit?: number },
): FetchState {
  const { fromMs, toMs } = useMetricsRange()
  const skip = opts?.skip ?? false
  const limit = opts?.limit ?? 500

  const url = skip
    ? null
    : `/ui-api/pipelines/${pipelineId}/logs?query=${encodeURIComponent(query)}&from=${fromMs}&to=${toMs}&limit=${limit}`

  const [data, setData] = useState<LogsResponse | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(!skip)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!url) {
      setData(undefined)
      setError(undefined)
      setIsLoading(false)
      return
    }
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
            /* ignore */
          }
          throw new Error(msg)
        }
        return (await res.json()) as LogsResponse
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
  }, [url, tick])

  const mutate = () => setTick((t) => t + 1)

  return { data, error, isLoading, mutate }
}
