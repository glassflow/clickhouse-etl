import { describe, it, expect, vi } from 'vitest'
import React from 'react'
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
