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
    const input = screen.getByPlaceholderText(/tag/i)
    fireEvent.change(input, { target: { value: 'sometag' } })
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })
})
