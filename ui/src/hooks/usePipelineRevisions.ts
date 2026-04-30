'use client'

import { useEffect, useState } from 'react'

export type PipelineRevision = {
  id: string
  pipelineId: string
  revision: number
  config: Record<string, unknown>
  env: string
  createdAt: string
  createdBy: string | null
}

/**
 * Client hook for the revisions list endpoint. Same hand-rolled fetcher
 * pattern as useLibraryLinks / useLibraryDetail.
 */
export function usePipelineRevisions(pipelineId: string | null) {
  const [data, setData] = useState<PipelineRevision[] | null>(null)
  const [isLoading, setIsLoading] = useState(pipelineId !== null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!pipelineId) {
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`/ui-api/pipelines/${pipelineId}/revisions`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<PipelineRevision[]>
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

    return () => {
      cancelled = true
    }
  }, [pipelineId, tick])

  const mutate = () => setTick((t) => t + 1)

  return {
    data: data ?? [],
    error: error ?? undefined,
    isLoading,
    mutate,
  }
}
