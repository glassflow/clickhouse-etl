import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterChip } from './FilterChip'

describe('FilterChip', () => {
  it('renders label and values', () => {
    render(
      <FilterChip label="Status" values={['active', 'paused']} onRemove={vi.fn()} />,
    )
    expect(screen.getByText('Status: active, paused')).toBeInTheDocument()
  })

  it('returns null when values are empty', () => {
    const { container } = render(
      <FilterChip label="Status" values={[]} onRemove={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn()
    render(
      <FilterChip label="Tags" values={['prod']} onRemove={onRemove} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
