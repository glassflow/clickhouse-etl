'use client'

import { useEffect, useState } from 'react'

export type DriftLevel = 'none' | 'patch' | 'minor' | 'major'

export type LibraryLink = {
  resourceKind: 'kafka_connection' | 'clickhouse_connection' | 'schema' | 'transform'
  resourceId: string
  resourceName: string | null
  pinnedVersion: string | null
  latestVersion: string | null
  drift: DriftLevel
  lastUpgradedAt: string | null
}

export type LibraryLinksResponse = {
  links: LibraryLink[]
  revision: number | null
}

/**
 * Client hook for the library-links endpoint. Mirrors the hand-rolled fetcher
 * pattern in useLibraryDetail.ts (the codebase doesn't ship SWR), so cache
 * semantics here are: refetch on `mutate()`, refetch when pipelineId changes.
 */
export function useLibraryLinks(pipelineId: string | null) {
  const [data, setData] = useState<LibraryLinksResponse | null>(null)
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

    fetch(`/ui-api/pipelines/${pipelineId}/library-links`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<LibraryLinksResponse>
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
  const links = data?.links ?? []
  const driftCount = links.filter((l) => l.drift !== 'none').length

  return {
    links,
    revision: data?.revision ?? null,
    driftCount,
    error: error ?? undefined,
    isLoading,
    mutate,
  }
}
