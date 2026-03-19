import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelineFilterMenu } from './PipelineFilterMenu'
import type { FilterState } from './utils/filterUrl'

const defaultFilters: FilterState = {
  status: [],
  health: [],
  tags: [],
}

describe('PipelineFilterMenu', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(
      <PipelineFilterMenu
        isOpen={false}
        onClose={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders Status, Health sections when open', () => {
    render(
      <PipelineFilterMenu
        isOpen
        onClose={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Health')).toBeInTheDocument()
  })

  it('calls onFiltersChange when status checkbox is toggled', () => {
    const onFiltersChange = vi.fn()
    render(
      <PipelineFilterMenu
        isOpen
        onClose={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
      />,
    )
    fireEvent.click(screen.getByText('Active'))
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      status: ['active'],
    })
  })

  it('calls onFiltersChange when health checkbox is toggled', () => {
    const onFiltersChange = vi.fn()
    render(
      <PipelineFilterMenu
        isOpen
        onClose={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
      />,
    )
    fireEvent.click(screen.getByText('Stable'))
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      health: ['stable'],
    })
  })

  it('calls onFiltersChange when tag is clicked', () => {
    const onFiltersChange = vi.fn()
    render(
      <PipelineFilterMenu
        isOpen
        onClose={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        availableTags={['prod', 'staging']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'prod' }))
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      tags: ['prod'],
    })
  })

  it('renders Tags section when availableTags is provided', () => {
    render(
      <PipelineFilterMenu
        isOpen
        onClose={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        availableTags={['prod']}
      />,
    )
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'prod' })).toBeInTheDocument()
  })
})
