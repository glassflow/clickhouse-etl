# Pipelines List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the pipelines list page with saved views, multi-select bulk actions, inline search, density toggle, and visual cell improvements while preserving all existing functionality.

**Architecture:** New feature hooks (`useBulkSelection`, `useListSearch`, `useSavedViews`) are composed into the existing `PipelinesList` orchestrator. New UI components (`PipelinesToolbar`, `SavedViewsStrip`, `BulkActionBar`, `BulkTagModal`, `PipelinesEmptyState`) are mounted around the unchanged `PipelinesTable`. Column definitions in `pipelineListColumns.tsx` gain visual improvements (status dot, type glyphs, DLQ coloring, name sub-line). `PipelinesTable` gains an optional `rowClassName` prop for row-level tinting.

**Tech Stack:** React 18, Next.js 16 App Router, TypeScript strict, Vitest + jsdom, Tailwind + CSS tokens (no hardcoded colors)

---

## File Map

**Create:**
- `src/modules/pipelines/hooks/useBulkSelection.ts`
- `src/modules/pipelines/hooks/useBulkSelection.test.ts`
- `src/modules/pipelines/hooks/useListSearch.ts`
- `src/modules/pipelines/hooks/useListSearch.test.ts`
- `src/modules/pipelines/hooks/useSavedViews.ts`
- `src/modules/pipelines/hooks/useSavedViews.test.ts`
- `src/modules/pipelines/components/PipelinesToolbar.tsx`
- `src/modules/pipelines/components/PipelinesToolbar.test.tsx`
- `src/modules/pipelines/components/SavedViewsStrip.tsx`
- `src/modules/pipelines/components/SavedViewsStrip.test.tsx`
- `src/modules/pipelines/components/BulkActionBar.tsx`
- `src/modules/pipelines/components/BulkActionBar.test.tsx`
- `src/modules/pipelines/components/BulkTagModal.tsx`
- `src/modules/pipelines/components/BulkTagModal.test.tsx`
- `src/modules/pipelines/components/PipelinesEmptyState.tsx`
- `src/modules/pipelines/components/PipelinesEmptyState.test.tsx`

**Modify:**
- `src/themes/base.css` — add `--color-purple-300`
- `src/modules/pipelines/PipelinesTable.tsx` — add `rowClassName` prop
- `src/modules/pipelines/PipelinesTable.test.tsx` — extend with rowClassName tests
- `src/modules/pipelines/columns/pipelineListColumns.tsx` — checkbox, status dot, glyphs, DLQ, name sub-line
- `src/modules/pipelines/PipelinesList.tsx` — compose all new hooks and components
- `src/modules/pipelines/PipelinesPageClient.tsx` — swap `NoPipelines` → `PipelinesEmptyState`

---

## Task 1: Purple Token

**Files:**
- Modify: `src/themes/base.css`

- [ ] **Step 1: Add `--color-purple-300` to base.css**

Open `src/themes/base.css`. Find the color primitive block (`:root { --color-*` declarations). Add:

```css
--color-purple-300: #b794ff;
```

- [ ] **Step 2: Verify the token is available**

Run:
```bash
grep -n "purple-300" src/themes/base.css
```
Expected: one line with `--color-purple-300: #b794ff;`

- [ ] **Step 3: Commit**

```bash
git add src/themes/base.css
git commit -m "feat: add --color-purple-300 token for pipeline type glyph"
```

---

## Task 2: `useBulkSelection` Hook

**Files:**
- Create: `src/modules/pipelines/hooks/useBulkSelection.ts`
- Create: `src/modules/pipelines/hooks/useBulkSelection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/pipelines/hooks/useBulkSelection.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/hooks/useBulkSelection.test.ts
```
Expected: FAIL with "Cannot find module './useBulkSelection'"

- [ ] **Step 3: Implement `useBulkSelection`**

Create `src/modules/pipelines/hooks/useBulkSelection.ts`:

```ts
'use client'

import { useState, useCallback } from 'react'

export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id))
      return allSelected ? new Set<string>() : new Set(ids)
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const allSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [selectedIds],
  )

  return {
    selectedIds,
    toggleRow,
    toggleAll,
    clearSelection,
    isSelected,
    selectedCount: selectedIds.size,
    someSelected: selectedIds.size > 0,
    allSelected,
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/hooks/useBulkSelection.test.ts
```
Expected: all 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/hooks/useBulkSelection.ts src/modules/pipelines/hooks/useBulkSelection.test.ts
git commit -m "feat: add useBulkSelection hook"
```

---

## Task 3: `useListSearch` Hook

**Files:**
- Create: `src/modules/pipelines/hooks/useListSearch.ts`
- Create: `src/modules/pipelines/hooks/useListSearch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/pipelines/hooks/useListSearch.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/hooks/useListSearch.test.ts
```
Expected: FAIL with "Cannot find module './useListSearch'"

- [ ] **Step 3: Implement `useListSearch`**

Create `src/modules/pipelines/hooks/useListSearch.ts`:

```ts
'use client'

import { useState, useCallback } from 'react'
import type { ListPipelineConfig } from '@/src/types/pipeline'

export function useListSearch() {
  const [searchQuery, setSearchQuery] = useState('')

  const clearSearch = useCallback(() => setSearchQuery(''), [])

  const filterBySearch = useCallback(
    (pipelines: ListPipelineConfig[]): ListPipelineConfig[] => {
      const trimmed = searchQuery.trim()
      if (!trimmed) return pipelines
      const q = trimmed.toLowerCase()
      return pipelines.filter((p) => p.name.toLowerCase().includes(q))
    },
    [searchQuery],
  )

  return { searchQuery, setSearchQuery, clearSearch, filterBySearch }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/hooks/useListSearch.test.ts
```
Expected: all 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/hooks/useListSearch.ts src/modules/pipelines/hooks/useListSearch.test.ts
git commit -m "feat: add useListSearch hook"
```

---

## Task 4: `useSavedViews` Hook

**Files:**
- Create: `src/modules/pipelines/hooks/useSavedViews.ts`
- Create: `src/modules/pipelines/hooks/useSavedViews.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/pipelines/hooks/useSavedViews.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/hooks/useSavedViews.test.ts
```
Expected: FAIL with "Cannot find module './useSavedViews'"

- [ ] **Step 3: Implement `useSavedViews`**

Create `src/modules/pipelines/hooks/useSavedViews.ts`:

```ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { FilterState } from '../utils/filterUrl'

export type SavedView = {
  id: string
  name: string
  filters: FilterState
  isBuiltIn: boolean
}

export interface SavedViewsAdapter {
  load(): Promise<SavedView[]>
  save(view: SavedView): Promise<void>
  delete(viewId: string): Promise<void>
}

const BUILT_IN_VIEWS: SavedView[] = [
  { id: 'all', name: 'All', filters: { status: [], health: [], tags: [] }, isBuiltIn: true },
  { id: 'running', name: 'Running', filters: { status: ['active'], health: [], tags: [] }, isBuiltIn: true },
  { id: 'dlq-watch', name: 'DLQ watch', filters: { status: [], health: ['unstable'], tags: [] }, isBuiltIn: true },
  { id: 'stopped', name: 'Stopped', filters: { status: ['stopped'], health: [], tags: [] }, isBuiltIn: true },
]

const STORAGE_KEY = 'gf_pipeline_views'

interface UseSavedViewsOptions {
  onFiltersChange: (filters: FilterState) => void
  initialFilters: FilterState
  adapter?: SavedViewsAdapter
}

export function useSavedViews({ onFiltersChange, adapter }: UseSavedViewsOptions) {
  const [views, setViews] = useState<SavedView[]>(BUILT_IN_VIEWS)
  const [activeViewId, setActiveViewId] = useState<string>('all')

  useEffect(() => {
    if (adapter) {
      adapter.load().then((userViews) => {
        setViews([...BUILT_IN_VIEWS, ...userViews.filter((v) => !v.isBuiltIn)])
      })
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        const userViews: SavedView[] = stored ? JSON.parse(stored) : []
        setViews([...BUILT_IN_VIEWS, ...userViews.filter((v) => !v.isBuiltIn)])
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  const selectView = useCallback(
    (id: string) => {
      setActiveViewId(id)
      const view = views.find((v) => v.id === id)
      if (view) onFiltersChange(view.filters)
    },
    [views, onFiltersChange],
  )

  const saveCurrentView = useCallback(
    async (name: string, filters: FilterState) => {
      const view: SavedView = { id: `user-${Date.now()}`, name, filters, isBuiltIn: false }
      const nextViews = [...views, view]
      setViews(nextViews)
      if (adapter) {
        await adapter.save(view)
      } else {
        const userViews = nextViews.filter((v) => !v.isBuiltIn)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userViews))
      }
    },
    [views, adapter],
  )

  const deleteView = useCallback(
    async (id: string) => {
      const view = views.find((v) => v.id === id)
      if (!view || view.isBuiltIn) return
      const nextViews = views.filter((v) => v.id !== id)
      setViews(nextViews)
      if (adapter) {
        await adapter.delete(id)
      } else {
        const userViews = nextViews.filter((v) => !v.isBuiltIn)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userViews))
      }
      if (activeViewId === id) {
        setActiveViewId('all')
        onFiltersChange(BUILT_IN_VIEWS[0].filters)
      }
    },
    [views, activeViewId, adapter, onFiltersChange],
  )

  return { views, activeViewId, selectView, saveCurrentView, deleteView }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/hooks/useSavedViews.test.ts
```
Expected: all 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/hooks/useSavedViews.ts src/modules/pipelines/hooks/useSavedViews.test.ts
git commit -m "feat: add useSavedViews hook with localStorage persistence and Postgres-ready adapter interface"
```

---

## Task 5: `PipelinesTable` — `rowClassName` Prop

**Files:**
- Modify: `src/modules/pipelines/PipelinesTable.tsx`
- Modify: `src/modules/pipelines/PipelinesTable.test.tsx`

- [ ] **Step 1: Write failing test**

In `src/modules/pipelines/PipelinesTable.test.tsx`, find the end of the existing tests and add:

```tsx
describe('rowClassName', () => {
  const columns: TableColumn<ListPipelineConfig>[] = [
    { key: 'name', header: 'Name', render: (item) => item.name },
  ]

  it('applies rowClassName result to each row', () => {
    const rowClassName = (item: ListPipelineConfig) =>
      item.pipeline_id === 'p1' ? 'highlight-row' : ''
    const { container } = render(
      <PipelinesTable data={mockData} columns={columns} rowClassName={rowClassName} />,
    )
    const rows = container.querySelectorAll('.table-row')
    expect(rows[0].className).toContain('highlight-row')
    expect(rows[1].className).not.toContain('highlight-row')
  })

  it('renders normally when rowClassName is not provided', () => {
    const { container } = render(<PipelinesTable data={mockData} columns={columns} />)
    const rows = container.querySelectorAll('.table-row')
    expect(rows[0].className).toContain('table-row')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/PipelinesTable.test.tsx
```
Expected: FAIL — "rowClassName" tests fail, existing tests pass

- [ ] **Step 3: Add `rowClassName` prop to `PipelinesTable`**

In `src/modules/pipelines/PipelinesTable.tsx`:

Add `rowClassName?: (item: ListPipelineConfig) => string` to `PipelinesTableProps`:

```tsx
export interface PipelinesTableProps {
  data: ListPipelineConfig[]
  columns: TableColumn<ListPipelineConfig>[]
  emptyMessage?: string
  className?: string
  onRowClick?: (item: ListPipelineConfig) => void
  isLoading?: boolean
  rowClassName?: (item: ListPipelineConfig) => string
}
```

Update the function signature to destructure `rowClassName`:

```tsx
export function PipelinesTable({
  data,
  columns,
  emptyMessage = 'No data found',
  className,
  onRowClick,
  isLoading = false,
  rowClassName,
}: PipelinesTableProps) {
```

Update the row `className` in the body (around line 219):

```tsx
<div
  key={item.pipeline_id}
  className={cn('table-row', onRowClick && 'cursor-pointer', rowClassName?.(item))}
  onClick={() => onRowClick?.(item)}
  style={{ gridTemplateColumns }}
>
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/PipelinesTable.test.tsx
```
Expected: all tests pass including new rowClassName tests

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/PipelinesTable.tsx src/modules/pipelines/PipelinesTable.test.tsx
git commit -m "feat: add rowClassName prop to PipelinesTable"
```

---

## Task 6: Column Visual Improvements

**Files:**
- Modify: `src/modules/pipelines/columns/pipelineListColumns.tsx`

This task makes four visual changes to existing columns and adds one new column. No test file exists yet for this; we add one.

- [ ] **Step 1: Write failing tests**

Create `src/modules/pipelines/columns/pipelineListColumns.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getPipelineListColumns } from './pipelineListColumns'
import type { ListPipelineConfig } from '@/src/types/pipeline'

vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }))
vi.mock('@/src/images/loader-small.svg', () => ({ default: 'loader.svg' }))

const baseConfig = {
  isPipelineLoading: () => false,
  getPipelineOperation: () => null,
  getEffectiveStatus: (p: ListPipelineConfig) => p.status as any,
  onStop: vi.fn(),
  onResume: vi.fn(),
  onEdit: vi.fn(),
  onRename: vi.fn(),
  onTerminate: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
  onManageTags: vi.fn(),
  onToggleSelect: vi.fn(),
  isSelected: () => false,
}

function renderCell(
  columnKey: string,
  pipeline: Partial<ListPipelineConfig>,
) {
  const pipeline_ = {
    pipeline_id: 'p1',
    name: 'Test Pipeline',
    transformation_type: 'Ingest Only',
    created_at: '2024-01-01T00:00:00Z',
    status: 'active',
    ...pipeline,
  } as ListPipelineConfig
  const columns = getPipelineListColumns(baseConfig)
  const col = columns.find((c) => c.key === columnKey)!
  const { container } = render(<div>{col.render!(pipeline_)}</div>)
  return container
}

describe('checkbox column', () => {
  it('renders a checkbox', () => {
    const { container } = renderCell('select', {})
    expect(container.querySelector('input[type="checkbox"]')).toBeTruthy()
  })

  it('calls onToggleSelect on click and stops propagation', () => {
    const onToggleSelect = vi.fn()
    const columns = getPipelineListColumns({ ...baseConfig, onToggleSelect })
    const col = columns.find((c) => c.key === 'select')!
    const pipeline = { pipeline_id: 'p1', name: 'T', transformation_type: 'Ingest Only', created_at: '', status: 'active' } as ListPipelineConfig
    const { container } = render(<div>{col.render!(pipeline)}</div>)
    fireEvent.click(container.querySelector('input[type="checkbox"]')!)
    expect(onToggleSelect).toHaveBeenCalledWith('p1')
  })
})

describe('status column — dot + label', () => {
  it('renders a status dot span with data-status attribute', () => {
    const container = renderCell('status', { status: 'active' })
    const dot = container.querySelector('[data-status]')
    expect(dot).toBeTruthy()
    expect(dot!.getAttribute('data-status')).toBe('active')
  })

  it('does not render a Badge component', () => {
    const container = renderCell('status', { status: 'active' })
    // Badge renders as a span with specific classes — check no badge class exists
    const badge = container.querySelector('.rounded-xl')
    expect(badge).toBeNull()
  })
})

describe('type glyphs', () => {
  it('Ingest Only → only I glyph', () => {
    const container = renderCell('operations', { transformation_type: 'Ingest Only' })
    expect(container.textContent).toContain('I')
    expect(container.textContent).not.toContain('D')
    expect(container.textContent).not.toContain('J')
  })

  it('Deduplication → I and D glyphs', () => {
    const container = renderCell('operations', { transformation_type: 'Deduplication' })
    expect(container.textContent).toContain('I')
    expect(container.textContent).toContain('D')
  })

  it('Join → I and J glyphs', () => {
    const container = renderCell('operations', { transformation_type: 'Join' })
    expect(container.textContent).toContain('I')
    expect(container.textContent).toContain('J')
  })

  it('Join & Deduplication → I, J, and D glyphs', () => {
    const container = renderCell('operations', { transformation_type: 'Join & Deduplication' })
    expect(container.textContent).toContain('I')
    expect(container.textContent).toContain('J')
    expect(container.textContent).toContain('D')
  })
})

describe('DLQ column coloring', () => {
  it('0 events → neutral faded class', () => {
    const container = renderCell('dlqStats', { dlq_stats: { unconsumed_messages: 0 } })
    expect(container.querySelector('[class*="neutral-faded"]')).toBeTruthy()
  })

  it('50 events → warning class', () => {
    const container = renderCell('dlqStats', { dlq_stats: { unconsumed_messages: 50 } })
    expect(container.querySelector('[class*="warning"]')).toBeTruthy()
  })

  it('100 events → critical class', () => {
    const container = renderCell('dlqStats', { dlq_stats: { unconsumed_messages: 100 } })
    expect(container.querySelector('[class*="critical"]')).toBeTruthy()
  })
})

describe('name column sub-line', () => {
  it('shows DLQ sub-line when health is unstable and DLQ > 0', () => {
    const container = renderCell('name', {
      health_status: 'unstable',
      dlq_stats: { unconsumed_messages: 5 },
    })
    expect(container.textContent).toContain('events in DLQ')
  })

  it('hides sub-line when health is stable', () => {
    const container = renderCell('name', {
      health_status: 'stable',
      dlq_stats: { unconsumed_messages: 5 },
    })
    expect(container.textContent).not.toContain('events in DLQ')
  })

  it('hides sub-line when DLQ is 0', () => {
    const container = renderCell('name', {
      health_status: 'unstable',
      dlq_stats: { unconsumed_messages: 0 },
    })
    expect(container.textContent).not.toContain('events in DLQ')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/columns/pipelineListColumns.test.tsx
```
Expected: multiple failures (no checkbox column, Badge still present, no glyphs, etc.)

- [ ] **Step 3: Rewrite `pipelineListColumns.tsx`**

Replace the entire file content of `src/modules/pipelines/columns/pipelineListColumns.tsx`:

```tsx
'use client'

import React from 'react'
import Image from 'next/image'
import { Badge } from '@/src/components/ui/badge'
import { ListPipelineConfig, PipelineStatus } from '@/src/types/pipeline'
import { TableColumn } from '@/src/modules/pipelines/PipelinesTable'
import { TableContextMenu } from '@/src/modules/pipelines/TableContextMenu'
import { getPipelineStatusLabel } from '@/src/utils/pipeline-status-display'
import { formatNumber, formatCreatedAt } from '@/src/utils/common.client'
import Loader from '@/src/images/loader-small.svg'

export interface PipelineListColumnsConfig {
  isPipelineLoading: (pipelineId: string) => boolean
  getPipelineOperation: (pipelineId: string) => string | null
  getEffectiveStatus: (pipeline: ListPipelineConfig) => PipelineStatus
  onStop: (pipeline: ListPipelineConfig) => void
  onResume: (pipeline: ListPipelineConfig) => void
  onEdit: (pipeline: ListPipelineConfig) => void
  onRename: (pipeline: ListPipelineConfig) => void
  onTerminate: (pipeline: ListPipelineConfig) => void
  onDelete: (pipeline: ListPipelineConfig) => void
  onDownload: (pipeline: ListPipelineConfig) => void
  onManageTags: (pipeline: ListPipelineConfig) => void
  onToggleSelect: (pipelineId: string) => void
  isSelected: (pipelineId: string) => boolean
}

const STATUS_DOT_CLASS: Record<string, string> = {
  active: 'bg-[var(--color-foreground-positive)]',
  resuming: 'bg-[var(--color-foreground-warning)]',
  pausing: 'bg-[var(--color-foreground-warning)]',
  paused: 'bg-[var(--color-foreground-neutral-faded)]',
  stopping: 'bg-[var(--color-foreground-neutral-faded)]',
  stopped: 'bg-[var(--color-foreground-neutral-faded)]',
  failed: 'bg-[var(--color-foreground-critical)]',
  terminated: 'bg-[var(--color-foreground-neutral-faded)]',
}

type TypeGlyph = { label: string; color: string }

function deriveTypeGlyphs(transformationType: string | undefined): TypeGlyph[] {
  const t = (transformationType || '').toLowerCase()
  const glyphs: TypeGlyph[] = [{ label: 'I', color: 'text-[var(--color-foreground-info)]' }]
  if (t.includes('join')) glyphs.push({ label: 'J', color: 'text-[var(--color-foreground-warning)]' })
  if (t.includes('dedup')) glyphs.push({ label: 'D', color: 'text-[var(--color-purple-300)]' })
  if (t.includes('filter')) glyphs.push({ label: 'F', color: 'text-[var(--color-foreground-positive)]' })
  if (t.includes('transform')) glyphs.push({ label: 'T', color: 'text-[var(--color-foreground-primary)]' })
  return glyphs
}

function TagsCell({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) {
    return <span className="text-sm text-[var(--color-foreground-neutral-faded)]">No tags</span>
  }
  const visibleTags = tags.slice(0, 3)
  const remaining = tags.length - visibleTags.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleTags.map((tag) => (
        <Badge key={tag} variant="outline" className="rounded-full px-2 py-0.5 text-xs font-medium">
          {tag}
        </Badge>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-[var(--color-foreground-neutral-faded)]">+{remaining} more</span>
      )}
    </div>
  )
}

export function getPipelineListColumns(
  config: PipelineListColumnsConfig,
): TableColumn<ListPipelineConfig>[] {
  const {
    isPipelineLoading,
    getPipelineOperation,
    getEffectiveStatus,
    onStop,
    onResume,
    onEdit,
    onRename,
    onTerminate,
    onDelete,
    onDownload,
    onManageTags,
    onToggleSelect,
    isSelected,
  } = config

  return [
    {
      key: 'select',
      header: '',
      width: '36px',
      sortable: false,
      render: (pipeline) => (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect(pipeline.pipeline_id)
          }}
          className="flex items-center justify-center"
        >
          <input
            type="checkbox"
            checked={isSelected(pipeline.pipeline_id)}
            onChange={() => {}}
            className="w-4 h-4 cursor-pointer accent-[var(--color-foreground-primary)]"
          />
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      width: '2fr',
      sortable: true,
      render: (pipeline) => {
        const isLoading = isPipelineLoading(pipeline.pipeline_id)
        const dlqCount = pipeline.dlq_stats?.unconsumed_messages ?? 0
        const showSubLine = pipeline.health_status === 'unstable' && dlqCount > 0
        return (
          <div className="flex items-center gap-2">
            {isLoading && (
              <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
            )}
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{pipeline.name}</span>
              {showSubLine && (
                <span className="text-xs font-mono text-[var(--color-foreground-critical)]">
                  {dlqCount.toLocaleString()} events in DLQ
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'operations',
      header: 'Transformation',
      width: '2fr',
      sortable: true,
      sortKey: 'transformation_type',
      render: (pipeline) => {
        const glyphs = deriveTypeGlyphs(pipeline.transformation_type)
        const label = pipeline.transformation_type || 'None'
        return (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {glyphs.map((g) => (
                <span key={g.label} className={`text-xs font-mono font-bold ${g.color}`}>
                  {g.label}
                </span>
              ))}
            </div>
            <span className="text-sm">{label}</span>
          </div>
        )
      },
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '2fr',
      align: 'left',
      render: (pipeline) => <TagsCell tags={pipeline.metadata?.tags || []} />,
    },
    {
      key: 'dlqStats',
      header: 'Events in DLQ',
      width: '1fr',
      align: 'left',
      sortable: true,
      sortKey: 'dlq_stats.unconsumed_messages',
      render: (pipeline) => {
        const count = pipeline.dlq_stats?.unconsumed_messages ?? 0
        let colorClass = 'text-[var(--color-foreground-neutral-faded)]'
        let weightClass = ''
        if (count >= 100) {
          colorClass = 'text-[var(--color-foreground-critical)]'
          weightClass = 'font-bold'
        } else if (count >= 1) {
          colorClass = 'text-[var(--color-foreground-warning)]'
        }
        return (
          <span className={`${colorClass} ${weightClass}`}>{formatNumber(count)}</span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '1fr',
      align: 'left',
      sortable: true,
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        const dotClass = STATUS_DOT_CLASS[effectiveStatus] ?? 'bg-[var(--color-foreground-neutral-faded)]'
        return (
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`}
              data-status={effectiveStatus}
            />
            <span className="font-mono text-xs">{getPipelineStatusLabel(effectiveStatus)}</span>
          </div>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Created',
      width: '1.5fr',
      align: 'left',
      sortable: true,
      render: (pipeline) => (
        <div className="flex flex-row items-center justify-start text-content">
          {formatCreatedAt(pipeline.created_at)}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '1fr',
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        return (
          <TableContextMenu
            pipelineStatus={effectiveStatus}
            isLoading={isPipelineLoading(pipeline.pipeline_id)}
            onStop={() => onStop(pipeline)}
            onResume={() => onResume(pipeline)}
            onEdit={() => onEdit(pipeline)}
            onRename={() => onRename(pipeline)}
            onTerminate={() => onTerminate(pipeline)}
            onDelete={() => onDelete(pipeline)}
            onDownload={() => onDownload(pipeline)}
            onManageTags={() => onManageTags(pipeline)}
          />
        )
      },
    },
  ]
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/columns/pipelineListColumns.test.tsx
```
Expected: all tests pass

- [ ] **Step 5: Run full pipelines suite to catch regressions**

```bash
pnpm test:run src/modules/pipelines/
```
Expected: all existing tests pass (PipelinesTable, hooks, FilterChip, etc.)

- [ ] **Step 6: Commit**

```bash
git add src/modules/pipelines/columns/pipelineListColumns.tsx src/modules/pipelines/columns/pipelineListColumns.test.tsx
git commit -m "feat: column visual improvements — checkbox, status dot, type glyphs, DLQ colors, name sub-line"
```

---

## Task 7: `PipelinesToolbar` Component

**Files:**
- Create: `src/modules/pipelines/components/PipelinesToolbar.tsx`
- Create: `src/modules/pipelines/components/PipelinesToolbar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/modules/pipelines/components/PipelinesToolbar.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelinesToolbar } from './PipelinesToolbar'
import type { FilterState } from '../utils/filterUrl'

const emptyFilters: FilterState = { status: [], health: [], tags: [] }

describe('PipelinesToolbar', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    filters: emptyFilters,
    onFiltersChange: vi.fn(),
    availableTags: [],
    densityMode: 'table' as const,
    onDensityChange: vi.fn(),
    filterButtonRef: React.createRef<HTMLButtonElement>(),
    isFilterMenuOpen: false,
    onFilterMenuToggle: vi.fn(),
  }

  it('renders search input', () => {
    render(<PipelinesToolbar {...defaultProps} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy()
  })

  it('calls onSearchChange when typing in search', () => {
    const onSearchChange = vi.fn()
    render(<PipelinesToolbar {...defaultProps} onSearchChange={onSearchChange} />)
    const input = screen.getByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(onSearchChange).toHaveBeenCalledWith('hello')
  })

  it('renders filter button', () => {
    render(<PipelinesToolbar {...defaultProps} />)
    expect(screen.getByLabelText(/filter/i)).toBeTruthy()
  })

  it('calls onFilterMenuToggle when filter button is clicked', () => {
    const onFilterMenuToggle = vi.fn()
    render(<PipelinesToolbar {...defaultProps} onFilterMenuToggle={onFilterMenuToggle} />)
    fireEvent.click(screen.getByLabelText(/filter/i))
    expect(onFilterMenuToggle).toHaveBeenCalled()
  })

  it('shows status filter chip when status filters are active', () => {
    render(
      <PipelinesToolbar
        {...defaultProps}
        filters={{ status: ['active'], health: [], tags: [] }}
      />,
    )
    expect(screen.getByText(/status/i)).toBeTruthy()
  })

  it('calls onDensityChange when density buttons clicked', () => {
    const onDensityChange = vi.fn()
    render(<PipelinesToolbar {...defaultProps} onDensityChange={onDensityChange} />)
    const tableBtn = screen.getByTitle('Table view')
    fireEvent.click(tableBtn)
    expect(onDensityChange).toHaveBeenCalledWith('table')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/components/PipelinesToolbar.test.tsx
```
Expected: FAIL with "Cannot find module './PipelinesToolbar'"

- [ ] **Step 3: Implement `PipelinesToolbar`**

Create `src/modules/pipelines/components/PipelinesToolbar.tsx`:

```tsx
'use client'

import React from 'react'
import { FilterIcon, SearchIcon } from '@/src/components/icons'
import { FilterChip } from '../FilterChip'
import type { FilterState } from '../utils/filterUrl'

type DensityMode = 'table' | 'hybrid' | 'cards'

interface PipelinesToolbarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  availableTags: string[]
  densityMode: DensityMode
  onDensityChange: (mode: DensityMode) => void
  filterButtonRef: React.RefObject<HTMLButtonElement>
  isFilterMenuOpen: boolean
  onFilterMenuToggle: () => void
}

export function PipelinesToolbar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  densityMode,
  onDensityChange,
  filterButtonRef,
  onFilterMenuToggle,
}: PipelinesToolbarProps) {
  const hasActiveFilters = filters.status.length > 0 || filters.health.length > 0 || filters.tags.length > 0

  return (
    <div className="flex items-center gap-3 w-full flex-wrap">
      {/* Search */}
      <div className="relative flex-grow min-w-[200px] max-w-sm">
        <SearchIcon
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-foreground-neutral-faded)] pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search pipelines…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--color-foreground-neutral)] placeholder:text-[var(--control-fg-placeholder)] focus:outline-none focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]"
        />
      </div>

      {/* Filter button */}
      <button
        ref={filterButtonRef}
        onClick={onFilterMenuToggle}
        className="p-2 hover:opacity-70 rounded-lg transition-opacity duration-200 relative"
        aria-label="Filter pipelines"
      >
        <FilterIcon size={20} className="text-[var(--color-foreground-neutral-faded)]" />
        {hasActiveFilters && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: 'linear-gradient(134deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end))' }}
          />
        )}
      </button>

      {/* Active filter chips */}
      {filters.status.length > 0 && (
        <FilterChip
          label="Status"
          values={filters.status.map((s) => s.charAt(0).toUpperCase() + s.slice(1))}
          onRemove={() => onFiltersChange({ ...filters, status: [] })}
          onClick={onFilterMenuToggle}
        />
      )}
      {filters.health.length > 0 && (
        <FilterChip
          label="Health"
          values={filters.health.map((h) => h.charAt(0).toUpperCase() + h.slice(1))}
          onRemove={() => onFiltersChange({ ...filters, health: [] })}
          onClick={onFilterMenuToggle}
        />
      )}
      {filters.tags.length > 0 && (
        <FilterChip
          label="Tags"
          values={filters.tags}
          onRemove={() => onFiltersChange({ ...filters, tags: [] })}
          onClick={onFilterMenuToggle}
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Density toggle */}
      <div className="flex items-center gap-1 rounded-lg p-1 bg-[var(--surface-bg)] border border-[var(--surface-border)]">
        {(['table', 'hybrid', 'cards'] as DensityMode[]).map((mode) => (
          <button
            key={mode}
            title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
            onClick={() => onDensityChange(mode)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              densityMode === mode
                ? 'bg-[var(--color-foreground-primary)] text-white'
                : 'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]'
            }`}
          >
            {mode.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/components/PipelinesToolbar.test.tsx
```
Expected: all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/components/PipelinesToolbar.tsx src/modules/pipelines/components/PipelinesToolbar.test.tsx
git commit -m "feat: add PipelinesToolbar with search, filter chips, and density toggle"
```

---

## Task 8: `SavedViewsStrip` Component

**Files:**
- Create: `src/modules/pipelines/components/SavedViewsStrip.tsx`
- Create: `src/modules/pipelines/components/SavedViewsStrip.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/modules/pipelines/components/SavedViewsStrip.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SavedViewsStrip } from './SavedViewsStrip'
import type { SavedView } from '../hooks/useSavedViews'
import type { FilterState } from '../utils/filterUrl'

const emptyFilters: FilterState = { status: [], health: [], tags: [] }

const builtInViews: SavedView[] = [
  { id: 'all', name: 'All', filters: emptyFilters, isBuiltIn: true },
  { id: 'running', name: 'Running', filters: { status: ['active'], health: [], tags: [] }, isBuiltIn: true },
]

const defaultProps = {
  views: builtInViews,
  activeViewId: 'all',
  onSelectView: vi.fn(),
  onSaveCurrentView: vi.fn(),
  onDeleteView: vi.fn(),
  getPipelineCount: () => 3,
}

describe('SavedViewsStrip', () => {
  it('renders all view tabs', () => {
    render(<SavedViewsStrip {...defaultProps} />)
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('Running')).toBeTruthy()
  })

  it('highlights the active tab', () => {
    render(<SavedViewsStrip {...defaultProps} activeViewId="running" />)
    const runningTab = screen.getByText('Running').closest('button')!
    expect(runningTab.className).toContain('active')
  })

  it('calls onSelectView when a tab is clicked', () => {
    const onSelectView = vi.fn()
    render(<SavedViewsStrip {...defaultProps} onSelectView={onSelectView} />)
    fireEvent.click(screen.getByText('Running'))
    expect(onSelectView).toHaveBeenCalledWith('running')
  })

  it('shows pipeline count badge on each tab', () => {
    render(<SavedViewsStrip {...defaultProps} getPipelineCount={() => 7} />)
    const badges = screen.getAllByText('7')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('does not show delete button on built-in tabs', () => {
    render(<SavedViewsStrip {...defaultProps} />)
    expect(screen.queryByLabelText(/delete view/i)).toBeNull()
  })

  it('shows delete button on user tabs', () => {
    const views: SavedView[] = [
      ...builtInViews,
      { id: 'u1', name: 'My View', filters: emptyFilters, isBuiltIn: false },
    ]
    render(<SavedViewsStrip {...defaultProps} views={views} />)
    expect(screen.getByLabelText(/delete.*my view/i)).toBeTruthy()
  })

  it('calls onDeleteView when delete button clicked', () => {
    const onDeleteView = vi.fn()
    const views: SavedView[] = [
      ...builtInViews,
      { id: 'u1', name: 'My View', filters: emptyFilters, isBuiltIn: false },
    ]
    render(<SavedViewsStrip {...defaultProps} views={views} onDeleteView={onDeleteView} />)
    fireEvent.click(screen.getByLabelText(/delete.*my view/i))
    expect(onDeleteView).toHaveBeenCalledWith('u1')
  })

  it('renders Save view button', () => {
    render(<SavedViewsStrip {...defaultProps} />)
    expect(screen.getByText(/save view/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/components/SavedViewsStrip.test.tsx
```
Expected: FAIL with "Cannot find module './SavedViewsStrip'"

- [ ] **Step 3: Implement `SavedViewsStrip`**

Create `src/modules/pipelines/components/SavedViewsStrip.tsx`:

```tsx
'use client'

import React, { useState, useRef } from 'react'
import type { SavedView } from '../hooks/useSavedViews'

interface SavedViewsStripProps {
  views: SavedView[]
  activeViewId: string
  onSelectView: (id: string) => void
  onSaveCurrentView: (name: string) => void
  onDeleteView: (id: string) => void
  getPipelineCount: (view: SavedView) => number
}

export function SavedViewsStrip({
  views,
  activeViewId,
  onSelectView,
  onSaveCurrentView,
  onDeleteView,
  getPipelineCount,
}: SavedViewsStripProps) {
  const [showSavePopover, setShowSavePopover] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSave = () => {
    const name = newViewName.trim()
    if (!name) return
    onSaveCurrentView(name)
    setNewViewName('')
    setShowSavePopover(false)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--surface-border)]">
      {views.map((view) => {
        const isActive = view.id === activeViewId
        const count = getPipelineCount(view)
        return (
          <div key={view.id} className="flex items-center shrink-0">
            <button
              onClick={() => onSelectView(view.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded-t-md ${
                isActive
                  ? 'active text-[var(--color-foreground-primary)] border-b-2 border-[var(--color-foreground-primary)]'
                  : 'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]'
              }`}
            >
              {view.name}
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--surface-bg)] border border-[var(--surface-border)]">
                {count}
              </span>
            </button>
            {!view.isBuiltIn && (
              <button
                aria-label={`Delete view ${view.name}`}
                onClick={() => onDeleteView(view.id)}
                className="ml-0.5 p-1 text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-critical)] transition-colors"
              >
                ×
              </button>
            )}
          </div>
        )
      })}

      {/* Save view */}
      <div className="relative shrink-0 ml-2">
        <button
          onClick={() => {
            setShowSavePopover(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          className="px-2 py-1.5 text-xs text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-primary)] transition-colors"
        >
          + Save view
        </button>
        {showSavePopover && (
          <div className="absolute top-full left-0 mt-1 z-10 bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-lg p-3 shadow-lg flex items-center gap-2 min-w-[220px]">
            <input
              ref={inputRef}
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') setShowSavePopover(false)
              }}
              placeholder="View name…"
              className="flex-1 text-sm bg-transparent border-b border-[var(--surface-border)] focus:outline-none focus:border-[var(--control-border-focus)] text-[var(--color-foreground-neutral)]"
            />
            <button
              onClick={handleSave}
              className="text-xs text-[var(--color-foreground-primary)] hover:opacity-70"
            >
              Save
            </button>
            <button
              onClick={() => setShowSavePopover(false)}
              className="text-xs text-[var(--color-foreground-neutral-faded)] hover:opacity-70"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/components/SavedViewsStrip.test.tsx
```
Expected: all 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/components/SavedViewsStrip.tsx src/modules/pipelines/components/SavedViewsStrip.test.tsx
git commit -m "feat: add SavedViewsStrip tab component with localStorage-backed saved views"
```

---

## Task 9: `BulkActionBar` Component

**Files:**
- Create: `src/modules/pipelines/components/BulkActionBar.tsx`
- Create: `src/modules/pipelines/components/BulkActionBar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/modules/pipelines/components/BulkActionBar.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BulkActionBar } from './BulkActionBar'

const defaultProps = {
  selectedCount: 3,
  totalVisible: 10,
  onStop: vi.fn(),
  onResume: vi.fn(),
  onTerminate: vi.fn(),
  onDelete: vi.fn(),
  onAddTag: vi.fn(),
  isLoading: false,
}

describe('BulkActionBar', () => {
  it('shows selected count and total visible', () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByText(/3 selected/)).toBeTruthy()
    expect(screen.getByText(/10/)).toBeTruthy()
  })

  it('renders Stop, Resume, Terminate, Add tag, Delete buttons', () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /stop/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /resume/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /terminate/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /add tag/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy()
  })

  it('disables all buttons when isLoading', () => {
    render(<BulkActionBar {...defaultProps} isLoading />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('calls onStop when Stop clicked', () => {
    const onStop = vi.fn()
    render(<BulkActionBar {...defaultProps} onStop={onStop} />)
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    expect(onStop).toHaveBeenCalled()
  })

  it('calls onResume when Resume clicked', () => {
    const onResume = vi.fn()
    render(<BulkActionBar {...defaultProps} onResume={onResume} />)
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expect(onResume).toHaveBeenCalled()
  })

  it('calls onTerminate when Terminate clicked', () => {
    const onTerminate = vi.fn()
    render(<BulkActionBar {...defaultProps} onTerminate={onTerminate} />)
    fireEvent.click(screen.getByRole('button', { name: /terminate/i }))
    expect(onTerminate).toHaveBeenCalled()
  })

  it('calls onAddTag when Add tag clicked', () => {
    const onAddTag = vi.fn()
    render(<BulkActionBar {...defaultProps} onAddTag={onAddTag} />)
    fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
    expect(onAddTag).toHaveBeenCalled()
  })

  it('calls onDelete when Delete clicked', () => {
    const onDelete = vi.fn()
    render(<BulkActionBar {...defaultProps} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/components/BulkActionBar.test.tsx
```
Expected: FAIL with "Cannot find module './BulkActionBar'"

- [ ] **Step 3: Implement `BulkActionBar`**

Create `src/modules/pipelines/components/BulkActionBar.tsx`:

```tsx
'use client'

import React from 'react'
import { Button } from '@/src/components/ui/button'

interface BulkActionBarProps {
  selectedCount: number
  totalVisible: number
  onStop: () => void
  onResume: () => void
  onTerminate: () => void
  onDelete: () => void
  onAddTag: () => void
  isLoading: boolean
}

export function BulkActionBar({
  selectedCount,
  totalVisible,
  onStop,
  onResume,
  onTerminate,
  onDelete,
  onAddTag,
  isLoading,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-[var(--surface-bg)] border border-[var(--surface-border)] flex-wrap">
      <span className="text-sm text-[var(--color-foreground-neutral)]">
        <span className="font-semibold">{selectedCount} selected</span>
        {' '}of {totalVisible} visible
      </span>

      <div className="flex-1" />

      <Button variant="ghost" size="sm" disabled={isLoading} onClick={onStop}>
        Stop
      </Button>
      <Button variant="ghost" size="sm" disabled={isLoading} onClick={onResume}>
        Resume
      </Button>
      <Button variant="ghost" size="sm" disabled={isLoading} onClick={onTerminate}>
        Terminate
      </Button>
      <Button variant="ghost" size="sm" disabled={isLoading} onClick={onAddTag}>
        Add tag
      </Button>
      <Button variant="destructive" size="sm" disabled={isLoading} onClick={onDelete}>
        Delete
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/components/BulkActionBar.test.tsx
```
Expected: all 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/components/BulkActionBar.tsx src/modules/pipelines/components/BulkActionBar.test.tsx
git commit -m "feat: add BulkActionBar with stop/resume/terminate/add-tag/delete actions"
```

---

## Task 10: `BulkTagModal` Component

**Files:**
- Create: `src/modules/pipelines/components/BulkTagModal.tsx`
- Create: `src/modules/pipelines/components/BulkTagModal.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/modules/pipelines/components/BulkTagModal.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BulkTagModal } from './BulkTagModal'

vi.mock('@/src/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogOverlay: () => <div />,
}))

describe('BulkTagModal', () => {
  const defaultProps = {
    visible: true,
    selectedCount: 3,
    onAddTags: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  }

  it('renders when visible', () => {
    render(<BulkTagModal {...defaultProps} />)
    expect(screen.getByText(/add tags/i)).toBeTruthy()
  })

  it('does not render when not visible', () => {
    render(<BulkTagModal {...defaultProps} visible={false} />)
    expect(screen.queryByText(/add tags/i)).toBeNull()
  })

  it('shows selected pipeline count', () => {
    render(<BulkTagModal {...defaultProps} />)
    expect(screen.getByText(/3 pipeline/i)).toBeTruthy()
  })

  it('calls onAddTags with entered tag on confirm', () => {
    const onAddTags = vi.fn()
    render(<BulkTagModal {...defaultProps} onAddTags={onAddTags} />)
    const input = screen.getByPlaceholderText(/tag/i)
    fireEvent.change(input, { target: { value: 'production' } })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onAddTags).toHaveBeenCalledWith(['production'])
  })

  it('calls onAddTags with multiple comma-separated tags', () => {
    const onAddTags = vi.fn()
    render(<BulkTagModal {...defaultProps} onAddTags={onAddTags} />)
    const input = screen.getByPlaceholderText(/tag/i)
    fireEvent.change(input, { target: { value: 'prod, staging, dev' } })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onAddTags).toHaveBeenCalledWith(['prod', 'staging', 'dev'])
  })

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn()
    render(<BulkTagModal {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables Add button when isLoading', () => {
    render(<BulkTagModal {...defaultProps} isLoading />)
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/components/BulkTagModal.test.tsx
```
Expected: FAIL with "Cannot find module './BulkTagModal'"

- [ ] **Step 3: Implement `BulkTagModal`**

Create `src/modules/pipelines/components/BulkTagModal.tsx`:

```tsx
'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'

interface BulkTagModalProps {
  visible: boolean
  selectedCount: number
  onAddTags: (tags: string[]) => void
  onCancel: () => void
  isLoading: boolean
}

export function BulkTagModal({ visible, selectedCount, onAddTags, onCancel, isLoading }: BulkTagModalProps) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    const tags = input
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tags.length === 0) return
    onAddTags(tags)
    setInput('')
  }

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0">
        <DialogTitle className="modal-title">Add Tags</DialogTitle>
        <DialogDescription className="modal-description">
          Adding tags to {selectedCount} pipeline{selectedCount !== 1 ? 's' : ''}. Separate multiple tags with commas.
        </DialogDescription>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Enter tag(s)…"
          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--color-foreground-neutral)] placeholder:text-[var(--control-fg-placeholder)] focus:outline-none focus:border-[var(--control-border-focus)] mt-4"
        />

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={isLoading || !input.trim()}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/components/BulkTagModal.test.tsx
```
Expected: all 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/components/BulkTagModal.tsx src/modules/pipelines/components/BulkTagModal.test.tsx
git commit -m "feat: add BulkTagModal for adding tags to multiple pipelines"
```

---

## Task 11: `PipelinesEmptyState` Component

**Files:**
- Create: `src/modules/pipelines/components/PipelinesEmptyState.tsx`
- Create: `src/modules/pipelines/components/PipelinesEmptyState.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/modules/pipelines/components/PipelinesEmptyState.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PipelinesEmptyState } from './PipelinesEmptyState'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/src/hooks/useJourneyAnalytics', () => ({
  useJourneyAnalytics: () => ({ page: { pipelines: vi.fn() } }),
}))

describe('PipelinesEmptyState', () => {
  it('renders the empty state heading', () => {
    render(<PipelinesEmptyState />)
    expect(screen.getByText(/no pipelines yet/i)).toBeTruthy()
  })

  it('renders Create from scratch CTA', () => {
    render(<PipelinesEmptyState />)
    expect(screen.getByRole('button', { name: /create from scratch/i })).toBeTruthy()
  })

  it('renders Create with AI CTA', () => {
    render(<PipelinesEmptyState />)
    expect(screen.getByRole('button', { name: /create with ai/i })).toBeTruthy()
  })

  it('renders quick-start template cards', () => {
    render(<PipelinesEmptyState />)
    expect(screen.getByText(/dedup/i)).toBeTruthy()
    expect(screen.getByText(/filter/i)).toBeTruthy()
    expect(screen.getByText(/direct ingest/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test:run src/modules/pipelines/components/PipelinesEmptyState.test.tsx
```
Expected: FAIL with "Cannot find module './PipelinesEmptyState'"

- [ ] **Step 3: Implement `PipelinesEmptyState`**

Create `src/modules/pipelines/components/PipelinesEmptyState.tsx`:

```tsx
'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

const TEMPLATES = [
  { id: 'dedup', label: 'Dedup', description: 'Remove duplicate events from your stream' },
  { id: 'filter', label: 'Filter', description: 'Drop unwanted events before they land' },
  { id: 'direct-ingest', label: 'Direct ingest', description: 'Stream events straight to ClickHouse' },
]

export function PipelinesEmptyState() {
  const analytics = useJourneyAnalytics()
  const router = useRouter()

  useEffect(() => {
    analytics.page.pipelines({})
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-10 w-full max-w-2xl mx-auto text-center">
      {/* Pipeline glyph */}
      <div className="flex items-center gap-3 text-[var(--color-foreground-neutral-faded)]">
        <div className="w-10 h-10 rounded-lg border border-[var(--surface-border)] flex items-center justify-center text-sm font-mono font-bold text-[var(--color-foreground-info)]">
          I
        </div>
        <div className="w-6 h-px bg-[var(--surface-border)]" />
        <div className="w-10 h-10 rounded-lg border border-[var(--surface-border)] flex items-center justify-center text-sm font-mono font-bold text-[var(--color-foreground-primary)]">
          T
        </div>
        <div className="w-6 h-px bg-[var(--surface-border)]" />
        <div className="w-10 h-10 rounded-lg border border-[var(--surface-border)] flex items-center justify-center text-sm font-mono font-bold text-[var(--color-foreground-positive)]">
          S
        </div>
      </div>

      {/* Copy */}
      <div className="flex flex-col gap-3">
        <h2 className="title-4 text-[var(--color-foreground-neutral)]">No pipelines yet</h2>
        <p className="body-3 text-[var(--color-foreground-neutral-faded)] max-w-sm mx-auto">
          Connect your Kafka source to ClickHouse — filter, transform, and deduplicate events along the way.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Button variant="primary" size="default" onClick={() => router.push('/home')}>
          Create from scratch
        </Button>
        <Button variant="secondary" size="default" onClick={() => router.push('/pipelines/create/ai')}>
          Create with AI
        </Button>
      </div>

      {/* Quick-start template cards */}
      <div className="w-full">
        <p className="caption-1 text-[var(--color-foreground-neutral-faded)] mb-4">Quick-start templates</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => router.push('/home')}
              className="text-left p-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-bg)] hover:border-[var(--color-foreground-primary)] transition-colors group"
            >
              <p className="body-3 font-semibold text-[var(--color-foreground-neutral)] group-hover:text-[var(--color-foreground-primary)]">
                {tpl.label}
              </p>
              <p className="caption-1 text-[var(--color-foreground-neutral-faded)] mt-1">
                {tpl.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test:run src/modules/pipelines/components/PipelinesEmptyState.test.tsx
```
Expected: all 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pipelines/components/PipelinesEmptyState.tsx src/modules/pipelines/components/PipelinesEmptyState.test.tsx
git commit -m "feat: add PipelinesEmptyState with CTAs and quick-start template cards"
```

---

## Task 12: Wire `PipelinesList`

**Files:**
- Modify: `src/modules/pipelines/PipelinesList.tsx`

This task composes all new hooks and components into the existing orchestrator. The existing modal and operation code is preserved verbatim; we add new state, wrap the filter pipeline with search, and adjust the rendered structure.

- [ ] **Step 1: Update imports in `PipelinesList.tsx`**

Replace the current import block with:

```tsx
'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { ListPipelineConfig } from '@/src/types/pipeline'
import { PipelinesTable } from '@/src/modules/pipelines/PipelinesTable'
import { MobilePipelinesList } from '@/src/modules/pipelines/MobilePipelinesList'
import { CreateIcon } from '@/src/components/icons'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import StopPipelineModal from './components/StopPipelineModal'
import TerminatePipelineModal from './components/TerminatePipelineModal'
import DeletePipelineModal from './components/DeletePipelineModal'
import RenamePipelineModal from './components/RenamePipelineModal'
import EditPipelineModal from './components/EditPipelineModal'
import PipelineTagsModal from './components/PipelineTagsModal'
import { PipelineFilterMenu, FilterState } from './PipelineFilterMenu'
import { useFiltersFromUrl } from './utils/filterUrl'
import { useStopPipelineModal, useRenamePipelineModal, useEditPipelineModal, useTerminatePipelineModal } from './hooks'
import { PipelineStatus } from '@/src/types/pipeline'
import { notify } from '@/src/notifications'
import { handleApiError } from '@/src/notifications/api-error-handler'
import { updatePipelineMetadata } from '@/src/api/pipeline-api'
import { usePlatformDetection } from '@/src/hooks/usePlatformDetection'
import { useMultiplePipelineState, usePipelineOperations, usePipelineMonitoring } from '@/src/hooks/usePipelineStateAdapter'
import { getPipelineListColumns } from './columns/pipelineListColumns'
import { usePipelineListOperations } from './usePipelineListOperations'
import { DownloadFormatModal, type DownloadFormat } from '@/src/components/common/DownloadFormatModal'
import { useBulkSelection } from './hooks/useBulkSelection'
import { useListSearch } from './hooks/useListSearch'
import { useSavedViews } from './hooks/useSavedViews'
import { PipelinesToolbar } from './components/PipelinesToolbar'
import { SavedViewsStrip } from './components/SavedViewsStrip'
import { BulkActionBar } from './components/BulkActionBar'
import { BulkTagModal } from './components/BulkTagModal'
```

- [ ] **Step 2: Add new state inside `PipelinesList` function body**

After the existing `const [filters, setFilters] = useFiltersFromUrl()` line, add:

```tsx
const [densityMode, setDensityMode] = useState<'table' | 'hybrid' | 'cards'>('table')
const search = useListSearch()
const bulk = useBulkSelection()
const savedViews = useSavedViews({ onFiltersChange: setFilters, initialFilters: filters })

const [isBulkTagModalVisible, setIsBulkTagModalVisible] = useState(false)
const [isBulkLoading, setIsBulkLoading] = useState(false)
```

- [ ] **Step 3: Clear bulk selection when filters change**

After the existing `useEffect(() => { analytics.page.pipelines({}) }, [])`, add:

```tsx
useEffect(() => {
  bulk.clearSelection()
}, [filters])
```

- [ ] **Step 4: Update `filteredPipelines` memo to include search**

Replace:
```tsx
const filteredPipelines = useMemo(() => {
  return pipelines.filter((pipeline) => {
```

with:
```tsx
const filteredPipelines = useMemo(() => {
  const statusHealthTagFiltered = pipelines.filter((pipeline) => {
```

At the end of the filter function body, change `return true` → close the filter with:
```tsx
    return true
  })
  return search.filterBySearch(statusHealthTagFiltered)
}, [pipelines, filters, pipelineStatuses, search.filterBySearch])
```

> Important: the `filteredPipelines` memo dependency array must include `search.filterBySearch`.

- [ ] **Step 5: Add bulk operation handlers**

After the existing `handleDownloadWithFormat` callback, add:

```tsx
const handleBulkStop = useCallback(async () => {
  setIsBulkLoading(true)
  try {
    for (const id of bulk.selectedIds) {
      const pipeline = pipelines.find((p) => p.pipeline_id === id)
      if (pipeline) await handleStop(pipeline)
    }
  } finally {
    bulk.clearSelection()
    setIsBulkLoading(false)
  }
}, [bulk.selectedIds, pipelines, handleStop])

const handleBulkResume = useCallback(async () => {
  setIsBulkLoading(true)
  try {
    for (const id of bulk.selectedIds) {
      const pipeline = pipelines.find((p) => p.pipeline_id === id)
      if (pipeline) await handleResume(pipeline)
    }
  } finally {
    bulk.clearSelection()
    setIsBulkLoading(false)
  }
}, [bulk.selectedIds, pipelines, handleResume])

const handleBulkTerminate = useCallback(async () => {
  setIsBulkLoading(true)
  try {
    for (const id of bulk.selectedIds) {
      const pipeline = pipelines.find((p) => p.pipeline_id === id)
      if (pipeline) await handleTerminate(pipeline)
    }
  } finally {
    bulk.clearSelection()
    setIsBulkLoading(false)
  }
}, [bulk.selectedIds, pipelines, handleTerminate])

const handleBulkDelete = useCallback(async () => {
  setIsBulkLoading(true)
  try {
    for (const id of bulk.selectedIds) {
      const pipeline = pipelines.find((p) => p.pipeline_id === id)
      if (pipeline) await handleDelete(pipeline)
    }
  } finally {
    bulk.clearSelection()
    setIsBulkLoading(false)
  }
}, [bulk.selectedIds, pipelines, handleDelete])

const handleBulkAddTagsConfirm = useCallback(async (tags: string[]) => {
  if (!tags.length) return
  setIsBulkLoading(true)
  try {
    for (const id of bulk.selectedIds) {
      const pipeline = pipelines.find((p) => p.pipeline_id === id)
      if (!pipeline) continue
      const existingTags = pipeline.metadata?.tags || []
      const merged = Array.from(new Set([...existingTags, ...tags]))
      await updatePipelineMetadata(id, { tags: merged })
      onUpdatePipelineTags?.(id, merged)
    }
    notify({ variant: 'success', title: 'Tags added', description: `Tags added to ${bulk.selectedCount} pipelines.`, channel: 'toast' })
  } catch (error) {
    handleApiError(error, { operation: 'add tags' })
  } finally {
    setIsBulkTagModalVisible(false)
    bulk.clearSelection()
    setIsBulkLoading(false)
  }
}, [bulk.selectedIds, bulk.selectedCount, pipelines, onUpdatePipelineTags])
```

- [ ] **Step 6: Add `rowClassName` function**

Before the `columns` useMemo, add:

```tsx
const getRowClassName = useCallback(
  (pipeline: ListPipelineConfig): string => {
    const effectiveStatus = getEffectiveStatus(pipeline)
    if (effectiveStatus === 'failed') {
      return 'border-l-2 border-[var(--color-foreground-critical)] bg-[color-mix(in_srgb,var(--color-foreground-critical)_4%,transparent)]'
    }
    if (pipeline.health_status === 'unstable' && effectiveStatus !== 'failed') {
      return 'border-l-2 border-[var(--color-foreground-warning)] bg-[color-mix(in_srgb,var(--color-foreground-warning)_3%,transparent)]'
    }
    return ''
  },
  [getEffectiveStatus],
)
```

- [ ] **Step 7: Add `onToggleSelect` and `isSelected` to column config**

In the `columns` useMemo, update the `getPipelineListColumns` call to include:

```tsx
const columns = useMemo(
  () =>
    getPipelineListColumns({
      isPipelineLoading,
      getPipelineOperation,
      getEffectiveStatus,
      onStop: handleStop,
      onResume: handleResume,
      onEdit: handleEdit,
      onRename: handleRename,
      onTerminate: handleTerminate,
      onDelete: openDeleteConfirmModal,
      onDownload: handleOpenDownloadModal,
      onManageTags: handleManageTags,
      onToggleSelect: bulk.toggleRow,
      isSelected: bulk.isSelected,
    }),
  [
    isPipelineLoading,
    getPipelineOperation,
    getEffectiveStatus,
    handleStop,
    handleResume,
    handleEdit,
    handleRename,
    handleTerminate,
    openDeleteConfirmModal,
    handleOpenDownloadModal,
    handleManageTags,
    bulk.toggleRow,
    bulk.isSelected,
  ],
)
```

- [ ] **Step 8: Update the return JSX structure**

Replace the current `return (...)` block entirely:

```tsx
return (
  <div className="flex flex-col w-full gap-4">
    {/* Header row: title + new pipeline button */}
    <div className="flex items-center justify-between w-full">
      <h1 className="text-xl sm:text-2xl font-semibold">Pipelines</h1>
      <Button variant="primary" size="custom" onClick={handleCreate}>
        <CreateIcon className="action-icon" size={16} />
        New Pipeline
      </Button>
    </div>

    {/* Saved views tab strip */}
    <SavedViewsStrip
      views={savedViews.views}
      activeViewId={savedViews.activeViewId}
      onSelectView={savedViews.selectView}
      onSaveCurrentView={(name) => savedViews.saveCurrentView(name, filters)}
      onDeleteView={savedViews.deleteView}
      getPipelineCount={(view) => {
        if (view.id === savedViews.activeViewId) return filteredPipelines.length
        return pipelines.filter((p) => {
          if (view.filters.status.length > 0 && !view.filters.status.includes(getEffectiveStatus(p))) return false
          if (view.filters.health.length > 0 && !view.filters.health.includes(p.health_status || 'stable')) return false
          return true
        }).length
      }}
    />

    {/* Toolbar: search, filter button, chips, density toggle */}
    <PipelinesToolbar
      searchQuery={search.searchQuery}
      onSearchChange={search.setSearchQuery}
      filters={filters}
      onFiltersChange={setFilters}
      availableTags={availableTags}
      densityMode={densityMode}
      onDensityChange={setDensityMode}
      filterButtonRef={filterButtonRef}
      isFilterMenuOpen={isFilterMenuOpen}
      onFilterMenuToggle={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
    />

    {/* Filter Menu */}
    <PipelineFilterMenu
      isOpen={isFilterMenuOpen}
      onClose={() => setIsFilterMenuOpen(false)}
      filters={filters}
      onFiltersChange={setFilters}
      anchorEl={filterButtonRef.current}
      availableTags={availableTags}
    />

    {/* Bulk action bar */}
    {bulk.selectedCount > 0 && (
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalVisible={filteredPipelines.length}
        onStop={handleBulkStop}
        onResume={handleBulkResume}
        onTerminate={handleBulkTerminate}
        onDelete={handleBulkDelete}
        onAddTag={() => setIsBulkTagModalVisible(true)}
        isLoading={isBulkLoading}
      />
    )}

    {/* Desktop/Tablet Table */}
    <div className="hidden md:block">
      <PipelinesTable
        data={filteredPipelines}
        columns={columns}
        rowClassName={getRowClassName}
        emptyMessage="No pipelines found. Adjust your filters or create a new pipeline to get started."
        onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.pipeline_id}`)}
      />
    </div>

    {/* Mobile List */}
    <div className="md:hidden">
      <MobilePipelinesList
        pipelines={filteredPipelines}
        pipelineStatuses={pipelineStatuses}
        onStop={handleStop}
        onResume={handleResume}
        onEdit={handleEdit}
        onRename={handleRename}
        onTerminate={handleTerminate}
        onDelete={openDeleteConfirmModal}
        onManageTags={handleManageTags}
        onRowClick={(pipeline) => router.push(`/pipelines/${pipeline.pipeline_id}`)}
        isPipelineLoading={isPipelineLoading}
        getPipelineOperation={getPipelineOperation}
      />
    </div>

    {/* All existing modals — unchanged */}
    <PipelineTagsModal
      visible={isTagsModalVisible}
      pipelineName={tagsModalPipeline?.name || ''}
      initialTags={tagsModalPipeline?.metadata?.tags || []}
      onSave={handleTagsModalSave}
      onCancel={handleTagsModalClose}
      isSaving={isSavingTags}
    />
    <StopPipelineModal
      visible={isStopModalVisible}
      onOk={async () => { if (!stopSelectedPipeline) return; closeStopModal(); await handleStopConfirm(stopSelectedPipeline) }}
      onCancel={closeStopModal}
    />
    <RenamePipelineModal
      visible={isRenameModalVisible}
      currentName={renameSelectedPipeline?.name || ''}
      onOk={async (newName) => { if (!renameSelectedPipeline || !newName) return; closeRenameModal(); await handleRenameConfirm(renameSelectedPipeline, newName) }}
      onCancel={closeRenameModal}
    />
    <EditPipelineModal
      visible={isEditModalVisible}
      onOk={async () => { if (!editSelectedPipeline) return; closeEditModal(); await handleEditConfirm(editSelectedPipeline) }}
      onCancel={closeEditModal}
    />
    <TerminatePipelineModal
      visible={isTerminateModalVisible}
      onOk={async () => { if (!deleteSelectedPipeline) return; closeTerminateModal(); await handleTerminateConfirm(deleteSelectedPipeline) }}
      onCancel={closeTerminateModal}
    />
    <DeletePipelineModal
      visible={isDeleteConfirmVisible}
      pipelineName={deleteConfirmPipeline?.name}
      onOk={handleDeleteConfirm}
      onCancel={closeDeleteConfirmModal}
    />
    <DownloadFormatModal
      visible={!!downloadModalPipeline}
      onDownload={handleDownloadWithFormat}
      onCancel={() => setDownloadModalPipeline(null)}
    />
    <BulkTagModal
      visible={isBulkTagModalVisible}
      selectedCount={bulk.selectedCount}
      onAddTags={handleBulkAddTagsConfirm}
      onCancel={() => setIsBulkTagModalVisible(false)}
      isLoading={isBulkLoading}
    />
    <InfoModal
      visible={showPipelineLimitModal}
      title="Pipeline Limit Reached"
      description={`Only one active pipeline is allowed on ${isDocker ? 'Docker' : 'Local'} version. To create a new pipeline, you must first terminate or delete any currently active pipelines.`}
      okButtonText="Manage Pipelines"
      cancelButtonText="Cancel"
      onComplete={handlePipelineLimitModalComplete}
    />
  </div>
)
```

- [ ] **Step 9: Run the full pipelines test suite**

```bash
pnpm test:run src/modules/pipelines/
```
Expected: all tests pass. Fix any TypeScript compile errors before committing.

- [ ] **Step 10: Commit**

```bash
git add src/modules/pipelines/PipelinesList.tsx
git commit -m "feat: wire PipelinesList with bulk selection, search, saved views, and density toggle"
```

---

## Task 13: Swap `NoPipelines` → `PipelinesEmptyState` in `PipelinesPageClient`

**Files:**
- Modify: `src/modules/pipelines/PipelinesPageClient.tsx`

- [ ] **Step 1: Update import**

In `src/modules/pipelines/PipelinesPageClient.tsx`, replace:

```tsx
import { NoPipelines } from '@/src/modules/pipelines/NoPipelines'
```

with:

```tsx
import { PipelinesEmptyState } from '@/src/modules/pipelines/components/PipelinesEmptyState'
```

- [ ] **Step 2: Replace usage**

Replace:

```tsx
<NoPipelines />
```

with:

```tsx
<PipelinesEmptyState />
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test:run src/modules/pipelines/
```
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/modules/pipelines/PipelinesPageClient.tsx
git commit -m "feat: replace NoPipelines with PipelinesEmptyState in PipelinesPageClient"
```

---

## Final Smoke Test

- [ ] **Run the complete pipelines suite one final time**

```bash
pnpm test:run src/modules/pipelines/
```
Expected: all tests pass with no regressions

- [ ] **TypeScript check**

```bash
pnpm tsc --noEmit
```
Expected: no errors

- [ ] **Start dev server and manually verify**

```bash
pnpm dev
```

Open `/pipelines`. Verify:
1. Saved views tab strip shows (All, Running, DLQ watch, Stopped); clicking a tab filters the list
2. Search input filters pipelines by name in real time
3. Checkboxes appear; selecting rows shows `BulkActionBar`; bulk Stop/Resume/Terminate/Delete/Add tag work
4. Density toggle buttons are clickable (Table is functional; Hybrid/Cards are no-ops)
5. Status column shows dot + label instead of Badge
6. Transformation column shows type glyphs (I, D, J, etc.) before text
7. DLQ column: 0 = faded, 1-99 = yellow, 100+ = red+bold
8. Failed/unstable rows have colored left border tint
9. Unstable pipelines with DLQ > 0 show sub-line under pipeline name
10. Empty state (no pipelines) shows `PipelinesEmptyState` with 3 CTAs and template cards
11. Existing context menu actions (stop, resume, rename, edit, terminate, delete, download, tags) still work
