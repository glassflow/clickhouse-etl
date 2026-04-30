import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeRangePicker, DEFAULT_RANGES } from '../time-range-picker'

describe('TimeRangePicker', () => {
  it('renders the default ranges', () => {
    render(<TimeRangePicker value="1h" onChange={() => {}} />)
    DEFAULT_RANGES.forEach((r) => {
      expect(screen.getByText(r.label)).toBeInTheDocument()
    })
  })

  it('marks the selected range with aria-pressed', () => {
    render(<TimeRangePicker value="6h" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '6h' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '1h' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fires onChange with the selected range key', () => {
    const onChange = vi.fn()
    render(<TimeRangePicker value="1h" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '24h' }))
    expect(onChange).toHaveBeenCalledWith('24h')
  })
})
