import { describe, it, expect, vi } from 'vitest'
import React from 'react'
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
