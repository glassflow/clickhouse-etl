import { describe, it, expect, vi } from 'vitest'
import React from 'react'
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
