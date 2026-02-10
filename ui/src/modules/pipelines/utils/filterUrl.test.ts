import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  parseFiltersFromParams,
  serializeFilters,
  areFiltersEqual,
  useFiltersFromUrl,
  type FilterState,
} from './filterUrl'

const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  usePathname: () => '/pipelines',
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))

function createParams(entries: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(entries)) {
    params.set(key, value)
  }
  return params
}

describe('filterUrl', () => {
  describe('parseFiltersFromParams', () => {
    it('returns empty state when params are empty', () => {
      const params = new URLSearchParams()
      const result = parseFiltersFromParams(params)
      expect(result).toEqual({ status: [], health: [], tags: [] })
    })

    it('parses single status', () => {
      const params = createParams({ status: 'active' })
      const result = parseFiltersFromParams(params)
      expect(result.status).toEqual(['active'])
      expect(result.health).toEqual([])
      expect(result.tags).toEqual([])
    })

    it('parses multiple statuses (comma-separated)', () => {
      const params = createParams({ status: 'active,paused,stopped' })
      const result = parseFiltersFromParams(params)
      expect(result.status).toEqual(['active', 'paused', 'stopped'])
    })

    it('drops invalid status values', () => {
      const params = createParams({ status: 'active,invalid,stopped' })
      const result = parseFiltersFromParams(params)
      expect(result.status).toEqual(['active', 'stopped'])
    })

    it('normalizes status to lowercase', () => {
      const params = createParams({ status: 'ACTIVE,Paused' })
      const result = parseFiltersFromParams(params)
      expect(result.status).toEqual(['active', 'paused'])
    })

    it('parses single health', () => {
      const params = createParams({ health: 'stable' })
      const result = parseFiltersFromParams(params)
      expect(result.health).toEqual(['stable'])
    })

    it('parses health stable and unstable', () => {
      const params = createParams({ health: 'stable,unstable' })
      const result = parseFiltersFromParams(params)
      expect(result.health).toEqual(['stable', 'unstable'])
    })

    it('drops invalid health values', () => {
      const params = createParams({ health: 'stable,invalid' })
      const result = parseFiltersFromParams(params)
      expect(result.health).toEqual(['stable'])
    })

    it('parses tags (comma-separated)', () => {
      const params = createParams({ tags: 'tag1,tag2' })
      const result = parseFiltersFromParams(params)
      expect(result.tags).toEqual(['tag1', 'tag2'])
    })

    it('decodes encoded values in tags', () => {
      const params = createParams({ tags: encodeURIComponent('tag with spaces') })
      const result = parseFiltersFromParams(params)
      expect(result.tags).toEqual(['tag with spaces'])
    })

    it('parses status, health, and tags together', () => {
      const params = createParams({
        status: 'active,failed',
        health: 'unstable',
        tags: 'prod',
      })
      const result = parseFiltersFromParams(params)
      expect(result.status).toEqual(['active', 'failed'])
      expect(result.health).toEqual(['unstable'])
      expect(result.tags).toEqual(['prod'])
    })

    it('accepts failed as valid status', () => {
      const params = createParams({ status: 'failed' })
      const result = parseFiltersFromParams(params)
      expect(result.status).toEqual(['failed'])
    })
  })

  describe('serializeFilters', () => {
    it('returns empty string for empty state', () => {
      const filters: FilterState = { status: [], health: [], tags: [] }
      expect(serializeFilters(filters)).toBe('')
    })

    it('serializes status only', () => {
      const filters: FilterState = { status: ['active', 'paused'], health: [], tags: [] }
      expect(serializeFilters(filters)).toBe('status=active%2Cpaused')
    })

    it('serializes health only', () => {
      const filters: FilterState = { status: [], health: ['stable'], tags: [] }
      expect(serializeFilters(filters)).toBe('health=stable')
    })

    it('serializes tags only', () => {
      const filters: FilterState = { status: [], health: [], tags: ['a', 'b'] }
      expect(serializeFilters(filters)).toBe('tags=a%2Cb')
    })

    it('serializes combined filters', () => {
      const filters: FilterState = {
        status: ['active'],
        health: ['unstable'],
        tags: ['prod'],
      }
      const result = serializeFilters(filters)
      expect(result).toContain('status=active')
      expect(result).toContain('health=unstable')
      expect(result).toContain('tags=prod')
    })
  })

  describe('areFiltersEqual', () => {
    it('returns true for identical state', () => {
      const a: FilterState = { status: ['active'], health: [], tags: [] }
      const b: FilterState = { status: ['active'], health: [], tags: [] }
      expect(areFiltersEqual(a, b)).toBe(true)
    })

    it('returns true for both empty', () => {
      const a: FilterState = { status: [], health: [], tags: [] }
      const b: FilterState = { status: [], health: [], tags: [] }
      expect(areFiltersEqual(a, b)).toBe(true)
    })

    it('returns false when status length differs', () => {
      const a: FilterState = { status: ['active'], health: [], tags: [] }
      const b: FilterState = { status: ['active', 'paused'], health: [], tags: [] }
      expect(areFiltersEqual(a, b)).toBe(false)
    })

    it('returns false when health length differs', () => {
      const a: FilterState = { status: [], health: ['stable'], tags: [] }
      const b: FilterState = { status: [], health: [], tags: [] }
      expect(areFiltersEqual(a, b)).toBe(false)
    })

    it('returns false when tags length differs', () => {
      const a: FilterState = { status: [], health: [], tags: ['a'] }
      const b: FilterState = { status: [], health: [], tags: [] }
      expect(areFiltersEqual(a, b)).toBe(false)
    })

    it('returns false when same length but different status values', () => {
      const a: FilterState = { status: ['active'], health: [], tags: [] }
      const b: FilterState = { status: ['paused'], health: [], tags: [] }
      expect(areFiltersEqual(a, b)).toBe(false)
    })

    it('returns false when same length but different tags', () => {
      const a: FilterState = { status: [], health: [], tags: ['a'] }
      const b: FilterState = { status: [], health: [], tags: ['b'] }
      expect(areFiltersEqual(a, b)).toBe(false)
    })
  })

  describe('useFiltersFromUrl', () => {
    beforeEach(() => {
      mockReplace.mockClear()
      mockSearchParams = new URLSearchParams()
    })

    it('initial state matches parsed params when params are empty', () => {
      const { result } = renderHook(() => useFiltersFromUrl())
      expect(result.current[0]).toEqual({ status: [], health: [], tags: [] })
    })

    it('initial state matches parsed params when params have status', () => {
      mockSearchParams = createParams({ status: 'active,paused' })
      const { result } = renderHook(() => useFiltersFromUrl())
      expect(result.current[0].status).toEqual(['active', 'paused'])
    })

    it('setFilters updates state and effect calls router.replace with serialized query', async () => {
      const { result } = renderHook(() => useFiltersFromUrl())
      await act(async () => {
        result.current[1]({ status: ['active'], health: [], tags: [] })
      })
      expect(result.current[0].status).toEqual(['active'])
      expect(mockReplace).toHaveBeenCalledWith('/pipelines?status=active', { scroll: false })
    })
  })
})
