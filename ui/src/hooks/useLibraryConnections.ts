'use client'

import { useState, useEffect } from 'react'
import type { KafkaConfig } from '@/src/lib/kafka-client-interface'
import type { ClickHouseConfig } from '@/src/app/ui-api/clickhouse/clickhouse-utils'
import type { SchemaField } from '@/src/lib/db/schema'
import { getApiUrl } from '@/src/utils/mock-api'

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

export interface LibraryConnection {
  id: string
  kind: 'kafka' | 'clickhouse'
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface LibrarySchema {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  source: string
  registryUrl: string | null
  fields: SchemaField[]
  fieldCount: number
  pipelineCount: number
  createdAt: string
  updatedAt: string
  latestVersion: string | null
  hasDrift: boolean
  usedByCount: number
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
  return useLibraryFetch<KafkaConnection[]>(getApiUrl('library/connections/kafka'))
}

export function useClickhouseConnections() {
  return useLibraryFetch<ClickhouseConnection[]>(getApiUrl('library/connections/clickhouse'))
}

export function useLibrarySchemas() {
  return useLibraryFetch<LibrarySchema[]>(getApiUrl('library/schemas'))
}

export function useLibraryFolders() {
  return useLibraryFetch<LibraryFolder[]>(getApiUrl('library/folders'))
}

// ─── Transforms ──────────────────────────────────────────────────────────────

export interface LibraryTransform {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  language: 'js' | 'sql'
  code: string
  inputSchemaId: string | null
  outputSchemaId: string | null
  createdAt: string
  updatedAt: string
}

export function useLibraryTransforms() {
  return useLibraryFetch<LibraryTransform[]>(getApiUrl('library/transforms'))
}

// ─── Dedup configs ────────────────────────────────────────────────────────────

export interface LibraryDedupConfig {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  keyFields: string[]
  secondaryKeyFields: string[]
  windowDuration: string
  windowType: 'tumbling' | 'sliding'
  timeAttribute: 'event_time' | 'processing_time'
  onDuplicate: 'keep_first' | 'keep_last'
  lateEventPolicy: 'pass_through' | 'drop'
  stateBackend: 'nats-kv' | 'memory'
  latestVersion: string
  usedByCount: number
  hasDrift: boolean
  createdAt: string
  updatedAt: string
}

export function useLibraryDedupConfigs() {
  return useLibraryFetch<LibraryDedupConfig[]>(getApiUrl('library/dedup'))
}

// ─── Filter configs ───────────────────────────────────────────────────────────

export type LibraryFilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'is_null'
  | 'is_not_null'

export interface LibraryFilterRule {
  id: string
  field: string
  operator: LibraryFilterOperator
  value: string | null
}

export interface LibraryFilterRuleGroup {
  id: string
  combinator: 'and' | 'or'
  rules: Array<LibraryFilterRule | LibraryFilterRuleGroup>
}

export interface LibraryFilterConfig {
  id: string
  name: string
  description: string | null
  folderId: string | null
  tags: string[]
  boundSchemaId: string | null
  rules: Array<LibraryFilterRule | LibraryFilterRuleGroup>
  latestVersion: string
  usedByCount: number
  createdAt: string
  updatedAt: string
}

export function useLibraryFilterConfigs() {
  return useLibraryFetch<LibraryFilterConfig[]>(getApiUrl('library/filter'))
}
