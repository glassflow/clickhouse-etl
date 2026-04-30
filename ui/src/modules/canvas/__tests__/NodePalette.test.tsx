import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NodePalette } from '../NodePalette'

describe('NodePalette', () => {
  it('renders all node-kind cards', () => {
    render(<NodePalette />)
    expect(screen.getByText('Kafka source')).toBeInTheDocument()
    expect(screen.getByText('OTLP source')).toBeInTheDocument()
    expect(screen.getByText('Filter')).toBeInTheDocument()
    expect(screen.getByText('Deduplicate')).toBeInTheDocument()
    expect(screen.getByText('Transform')).toBeInTheDocument()
    expect(screen.getByText('Join')).toBeInTheDocument()
    expect(screen.getByText('ClickHouse sink')).toBeInTheDocument()
  })

  it('sets dataTransfer with the node kind on drag start', () => {
    render(<NodePalette />)
    const card = screen.getByText('Filter').closest('[data-palette-item]')
    expect(card).toBeTruthy()

    const setData = vi.fn()
    fireEvent.dragStart(card!, {
      dataTransfer: { setData, effectAllowed: 'move' },
    })
    expect(setData).toHaveBeenCalledWith('application/glassflow-node-kind', 'filter')
  })
})
