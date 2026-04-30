import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pill } from '../pill'

describe('Pill', () => {
  it('renders label', () => {
    render(<Pill>info</Pill>)
    expect(screen.getByText('info')).toBeInTheDocument()
  })

  it('renders count badge when count provided', () => {
    render(<Pill count={42}>warn</Pill>)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders swatch when swatchColor provided', () => {
    const { container } = render(<Pill swatchColor="var(--obs-severity-error)">error</Pill>)
    expect(container.querySelector('[data-pill-swatch]')).toBeTruthy()
  })

  it('toggles "selected" state via aria-pressed', () => {
    render(
      <Pill selected onSelect={() => {}}>
        info
      </Pill>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('fires onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<Pill onSelect={onSelect}>info</Pill>)
    fireEvent.click(screen.getByText('info'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
