'use client'

import { useEffect, useState } from 'react'
import type { LibraryTransform } from './useLibraryConnections'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SchemaVersion = {
  id: string
  schemaId: string
  version: string
  fields: Array<{ name: string; type: string; nullable: boolean }>
  changeSummary: string | null
  createdAt: string
  createdBy: string | null
}

export type UsedByEntry = {
  pipelineId: string
  pipelineName: string
  pinnedVersion?: string
}

interface FetchState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  mutate: () => void
}

// ─── Internal fetcher (mirrors useLibraryConnections pattern) ────────────────

function useDetailFetch<T>(url: string | null): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(url !== null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!url) {
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<T>
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
  }, [url, tick])

  const mutate = () => setTick((t) => t + 1)

  return { data, isLoading, error, mutate }
}

// ─── Public hooks ─────────────────────────────────────────────────────────────

export function useSchemaVersions(schemaId: string | null) {
  const url = schemaId ? `/ui-api/library/schemas/${schemaId}/versions` : null
  const result = useDetailFetch<SchemaVersion[]>(url)
  return {
    data: result.data ?? [],
    error: result.error ?? undefined,
    isLoading: result.isLoading,
    mutate: result.mutate,
  }
}

export function useSchemaUsedBy(schemaId: string | null) {
  const url = schemaId ? `/ui-api/library/schemas/${schemaId}/used-by` : null
  const result = useDetailFetch<{ usedBy: UsedByEntry[] }>(url)
  return {
    data: result.data?.usedBy ?? [],
    error: result.error ?? undefined,
    isLoading: result.isLoading,
    mutate: result.mutate,
  }
}

export function useKafkaConnectionUsedBy(connectionId: string | null) {
  const url = connectionId
    ? `/ui-api/library/connections/kafka/${connectionId}/used-by`
    : null
  const result = useDetailFetch<{ usedBy: UsedByEntry[] }>(url)
  return {
    data: result.data?.usedBy ?? [],
    error: result.error ?? undefined,
    isLoading: result.isLoading,
    mutate: result.mutate,
  }
}

export function useClickhouseConnectionUsedBy(connectionId: string | null) {
  const url = connectionId
    ? `/ui-api/library/connections/clickhouse/${connectionId}/used-by`
    : null
  const result = useDetailFetch<{ usedBy: UsedByEntry[] }>(url)
  return {
    data: result.data?.usedBy ?? [],
    error: result.error ?? undefined,
    isLoading: result.isLoading,
    mutate: result.mutate,
  }
}

export function useTransform(transformId: string | null) {
  const url = transformId ? `/ui-api/library/transforms/${transformId}` : null
  const result = useDetailFetch<LibraryTransform>(url)
  return {
    data: result.data ?? null,
    error: result.error ?? undefined,
    isLoading: result.isLoading,
    mutate: result.mutate,
  }
}

export type TransformVersion = {
  id: string
  transformId: string
  version: string
  language: 'js' | 'sql'
  code: string
  inputSchemaId: string | null
  outputSchemaId: string | null
  changeSummary: string | null
  createdAt: string
  createdBy: string | null
}

export function useTransformVersions(transformId: string | null) {
  const url = transformId ? `/ui-api/library/transforms/${transformId}/versions` : null
  const result = useDetailFetch<TransformVersion[]>(url)
  return {
    data: result.data ?? [],
    error: result.error ?? undefined,
    isLoading: result.isLoading,
    mutate: result.mutate,
  }
}
