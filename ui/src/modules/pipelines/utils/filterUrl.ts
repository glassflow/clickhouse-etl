'use client'

import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PipelineStatus } from '@/src/types/pipeline'

export interface FilterState {
  status: PipelineStatus[]
  health: ('stable' | 'unstable')[]
  tags: string[]
}

const STATUS_FILTER_SET = new Set<PipelineStatus>(['active', 'paused', 'stopped', 'failed'])
const HEALTH_FILTER_SET = new Set<'stable' | 'unstable'>(['stable', 'unstable'])

function parseCommaSeparatedValues(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => decodeURIComponent(item.trim()))
    .filter(Boolean)
}

export function parseFiltersFromParams(params: ReadonlyURLSearchParams | URLSearchParams): FilterState {
  const rawStatus = parseCommaSeparatedValues(params.get('status'))
  const status = rawStatus.reduce<PipelineStatus[]>((acc, value) => {
    const normalized = value.toLowerCase() as PipelineStatus
    if (STATUS_FILTER_SET.has(normalized)) {
      acc.push(normalized)
    }
    return acc
  }, [])

  const rawHealth = parseCommaSeparatedValues(params.get('health'))
  const health = rawHealth.reduce<Array<'stable' | 'unstable'>>((acc, value) => {
    const normalized = value.toLowerCase() as 'stable' | 'unstable'
    if (HEALTH_FILTER_SET.has(normalized)) {
      acc.push(normalized)
    }
    return acc
  }, [])

  const tags = parseCommaSeparatedValues(params.get('tags'))

  return { status, health, tags }
}

export function areFiltersEqual(a: FilterState, b: FilterState): boolean {
  if (a.status.length !== b.status.length || a.health.length !== b.health.length || a.tags.length !== b.tags.length) {
    return false
  }

  const compareArrays = (first: string[], second: string[]) => first.every((value, index) => second[index] === value)

  return compareArrays(a.status, b.status) && compareArrays(a.health, b.health) && compareArrays(a.tags, b.tags)
}

export function serializeFilters(filters: FilterState): string {
  const params = new URLSearchParams()
  if (filters.status.length > 0) {
    params.set('status', filters.status.join(','))
  }
  if (filters.health.length > 0) {
    params.set('health', filters.health.join(','))
  }
  if (filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','))
  }
  return params.toString()
}

/**
 * Hook that keeps pipeline list filters in sync with URL search params.
 * Returns [filters, setFilters]. Use setFilters when the user changes filters (e.g. in PipelineFilterMenu or FilterChip).
 */
export function useFiltersFromUrl(): [FilterState, React.Dispatch<React.SetStateAction<FilterState>>] {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [filters, setFilters] = useState<FilterState>(() => parseFiltersFromParams(searchParams))

  // Sync from URL when searchParams change (e.g. browser back/forward)
  useEffect(() => {
    const parsed = parseFiltersFromParams(searchParams)
    setFilters((current) => (areFiltersEqual(current, parsed) ? current : parsed))
  }, [searchParams])

  // Sync to URL when filters change
  useEffect(() => {
    const serialized = serializeFilters(filters)
    if (serialized === searchParams.toString()) {
      return
    }
    const nextUrl = serialized ? `${pathname}?${serialized}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [filters, pathname, router, searchParams])

  return [filters, setFilters]
}
