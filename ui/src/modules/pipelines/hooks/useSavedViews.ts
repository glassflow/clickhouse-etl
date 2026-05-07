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
