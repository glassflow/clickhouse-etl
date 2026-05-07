import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useListSearch } from './useListSearch'
import type { ListPipelineConfig } from '@/src/types/pipeline'

const pipelines: ListPipelineConfig[] = [
  { pipeline_id: 'p1', name: 'Alpha Pipeline', transformation_type: 'Deduplication', created_at: '2024-01-01T00:00:00Z', status: 'active' },
  { pipeline_id: 'p2', name: 'Beta Stream', transformation_type: 'Join', created_at: '2024-01-01T00:00:00Z', status: 'active' },
  { pipeline_id: 'p3', name: 'Gamma ETL', transformation_type: 'Ingest Only', created_at: '2024-01-01T00:00:00Z', status: 'stopped' },
]

describe('useListSearch', () => {
  it('initial state: empty query', () => {
    const { result } = renderHook(() => useListSearch())
    expect(result.current.searchQuery).toBe('')
  })

  it('filterBySearch returns full list when query is empty', () => {
    const { result } = renderHook(() => useListSearch())
    expect(result.current.filterBySearch(pipelines)).toHaveLength(3)
  })

  it('filterBySearch filters by name case-insensitively', () => {
    const { result } = renderHook(() => useListSearch())
    act(() => result.current.setSearchQuery('alpha'))
    expect(result.current.filterBySearch(pipelines)).toHaveLength(1)
    expect(result.current.filterBySearch(pipelines)[0].pipeline_id).toBe('p1')
  })

  it('filterBySearch is case-insensitive for uppercase query', () => {
    const { result } = renderHook(() => useListSearch())
    act(() => result.current.setSearchQuery('BETA'))
    expect(result.current.filterBySearch(pipelines)).toHaveLength(1)
    expect(result.current.filterBySearch(pipelines)[0].pipeline_id).toBe('p2')
  })

  it('filterBySearch returns empty for no matches', () => {
    const { result } = renderHook(() => useListSearch())
    act(() => result.current.setSearchQuery('xyz-no-match'))
    expect(result.current.filterBySearch(pipelines)).toHaveLength(0)
  })

  it('clearSearch resets the query', () => {
    const { result } = renderHook(() => useListSearch())
    act(() => result.current.setSearchQuery('alpha'))
    act(() => result.current.clearSearch())
    expect(result.current.searchQuery).toBe('')
    expect(result.current.filterBySearch(pipelines)).toHaveLength(3)
  })

  it('filterBySearch returns full list for whitespace-only query', () => {
    const { result } = renderHook(() => useListSearch())
    act(() => result.current.setSearchQuery('   '))
    expect(result.current.filterBySearch(pipelines)).toHaveLength(3)
  })
})
