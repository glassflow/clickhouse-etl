'use client'

import { useState, useEffect } from 'react'
import type { KafkaConfig } from '@/src/lib/kafka-client-interface'
import type { ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'
import type { SchemaField } from '@/src/lib/db/schema'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KafkaConnection {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  config: KafkaConfig
  createdAt: string
  updatedAt: string
}

export interface ClickhouseConnection {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  config: ClickHouseConfig
  createdAt: string
  updatedAt: string
}

export interface LibrarySchema {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  fields: SchemaField[]
  createdAt: string
  updatedAt: string
}

export interface LibraryFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
}

// ─── Generic fetcher hook ────────────────────────────────────────────────────

interface FetchState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  mutate: () => void
}

function useLibraryFetch<T>(url: string): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
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

export function useKafkaConnections() {
  return useLibraryFetch<KafkaConnection[]>('/ui-api/library/connections/kafka')
}

export function useClickhouseConnections() {
  return useLibraryFetch<ClickhouseConnection[]>('/ui-api/library/connections/clickhouse')
}

export function useLibrarySchemas() {
  return useLibraryFetch<LibrarySchema[]>('/ui-api/library/schemas')
}

export function useLibraryFolders() {
  return useLibraryFetch<LibraryFolder[]>('/ui-api/library/folders')
}
