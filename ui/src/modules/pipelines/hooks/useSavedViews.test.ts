import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSavedViews } from './useSavedViews'
import type { FilterState } from '../utils/filterUrl'

const emptyFilters: FilterState = { status: [], health: [], tags: [] }

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useSavedViews — built-in views', () => {
  it('always has 4 built-in views', () => {
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters }),
    )
    const builtIn = result.current.views.filter((v) => v.isBuiltIn)
    expect(builtIn).toHaveLength(4)
    expect(builtIn.map((v) => v.id)).toEqual(['all', 'running', 'dlq-watch', 'stopped'])
  })

  it('default active view is "all"', () => {
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters }),
    )
    expect(result.current.activeViewId).toBe('all')
  })

  it('built-in views cannot be deleted', async () => {
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters }),
    )
    await act(async () => result.current.deleteView('all'))
    const builtIn = result.current.views.filter((v) => v.isBuiltIn)
    expect(builtIn).toHaveLength(4)
  })
})

describe('useSavedViews — selectView', () => {
  it('selectView changes activeViewId and calls onFiltersChange', () => {
    const onFiltersChange = vi.fn()
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange, initialFilters: emptyFilters }),
    )
    act(() => result.current.selectView('running'))
    expect(result.current.activeViewId).toBe('running')
    expect(onFiltersChange).toHaveBeenCalledWith({ status: ['active'], health: [], tags: [] })
  })
})

describe('useSavedViews — user CRUD', () => {
  it('saveCurrentView adds a new user view', async () => {
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters }),
    )
    await act(async () => result.current.saveCurrentView('My View', { status: ['failed'], health: [], tags: [] }))
    const userViews = result.current.views.filter((v) => !v.isBuiltIn)
    expect(userViews).toHaveLength(1)
    expect(userViews[0].name).toBe('My View')
  })

  it('saveCurrentView persists to localStorage', async () => {
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters }),
    )
    await act(async () => result.current.saveCurrentView('Saved', { status: ['paused'], health: [], tags: [] }))
    const stored = JSON.parse(localStorage.getItem('gf_pipeline_views') || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('Saved')
  })

  it('deleteView removes user view', async () => {
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters }),
    )
    await act(async () => result.current.saveCurrentView('Temp', emptyFilters))
    const id = result.current.views.find((v) => !v.isBuiltIn)!.id
    await act(async () => result.current.deleteView(id))
    expect(result.current.views.filter((v) => !v.isBuiltIn)).toHaveLength(0)
  })

  it('deleteView resets to "all" when active view is deleted', async () => {
    const onFiltersChange = vi.fn()
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange, initialFilters: emptyFilters }),
    )
    await act(async () => result.current.saveCurrentView('Temp', emptyFilters))
    const id = result.current.views.find((v) => !v.isBuiltIn)!.id
    act(() => result.current.selectView(id))
    await act(async () => result.current.deleteView(id))
    expect(result.current.activeViewId).toBe('all')
  })
})

describe('useSavedViews — adapter interface', () => {
  it('uses adapter.load() when adapter provided', async () => {
    const userView = { id: 'u1', name: 'From DB', filters: emptyFilters, isBuiltIn: false }
    const adapter = {
      load: vi.fn().mockResolvedValue([userView]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters, adapter }),
    )
    // Wait for effect
    await act(async () => {})
    expect(adapter.load).toHaveBeenCalled()
    expect(result.current.views.find((v) => v.id === 'u1')).toBeDefined()
  })

  it('uses adapter.save() when saving', async () => {
    const adapter = {
      load: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters, adapter }),
    )
    await act(async () => result.current.saveCurrentView('New', emptyFilters))
    expect(adapter.save).toHaveBeenCalled()
  })

  it('uses adapter.delete() when deleting', async () => {
    const userView = { id: 'u1', name: 'From DB', filters: emptyFilters, isBuiltIn: false }
    const adapter = {
      load: vi.fn().mockResolvedValue([userView]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    const { result } = renderHook(() =>
      useSavedViews({ onFiltersChange: vi.fn(), initialFilters: emptyFilters, adapter }),
    )
    await act(async () => {})
    await act(async () => result.current.deleteView('u1'))
    expect(adapter.delete).toHaveBeenCalledWith('u1')
  })
})
