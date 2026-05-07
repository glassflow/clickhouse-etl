import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkSelection } from './useBulkSelection'

describe('useBulkSelection', () => {
  it('initial state: empty selection', () => {
    const { result } = renderHook(() => useBulkSelection())
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.someSelected).toBe(false)
  })

  it('toggleRow selects an id', () => {
    const { result } = renderHook(() => useBulkSelection())
    act(() => result.current.toggleRow('p1'))
    expect(result.current.isSelected('p1')).toBe(true)
    expect(result.current.selectedCount).toBe(1)
    expect(result.current.someSelected).toBe(true)
  })

  it('toggleRow deselects an already-selected id', () => {
    const { result } = renderHook(() => useBulkSelection())
    act(() => result.current.toggleRow('p1'))
    act(() => result.current.toggleRow('p1'))
    expect(result.current.isSelected('p1')).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('toggleAll selects all when none selected', () => {
    const { result } = renderHook(() => useBulkSelection())
    act(() => result.current.toggleAll(['p1', 'p2', 'p3']))
    expect(result.current.selectedCount).toBe(3)
    expect(result.current.allSelected(['p1', 'p2', 'p3'])).toBe(true)
  })

  it('toggleAll deselects all when all selected', () => {
    const { result } = renderHook(() => useBulkSelection())
    act(() => result.current.toggleAll(['p1', 'p2']))
    act(() => result.current.toggleAll(['p1', 'p2']))
    expect(result.current.selectedCount).toBe(0)
  })

  it('toggleAll selects all when some selected', () => {
    const { result } = renderHook(() => useBulkSelection())
    act(() => result.current.toggleRow('p1'))
    act(() => result.current.toggleAll(['p1', 'p2', 'p3']))
    expect(result.current.selectedCount).toBe(3)
  })

  it('clearSelection empties selection', () => {
    const { result } = renderHook(() => useBulkSelection())
    act(() => result.current.toggleRow('p1'))
    act(() => result.current.toggleRow('p2'))
    act(() => result.current.clearSelection())
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.someSelected).toBe(false)
  })

  it('allSelected returns false for empty ids list', () => {
    const { result } = renderHook(() => useBulkSelection())
    expect(result.current.allSelected([])).toBe(false)
  })
})
