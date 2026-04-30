import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ValidationBadge } from '../ValidationBadge'

describe('ValidationBadge', () => {
  it('returns null when no messages', () => {
    const { container } = render(<ValidationBadge messages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders error count when at least one error exists', () => {
    render(
      <ValidationBadge
        messages={[
          { code: 'a', severity: 'error', message: 'x' },
          { code: 'b', severity: 'error', message: 'y' },
          { code: 'c', severity: 'warning', message: 'z' },
        ]}
      />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByLabelText(/2 errors/)).toBeInTheDocument()
  })

  it('renders warning-only state with yellow tone', () => {
    const { container } = render(
      <ValidationBadge messages={[{ code: 'a', severity: 'warning', message: 'x' }]} />,
    )
    expect(container.firstChild).toHaveAttribute('data-severity', 'warning')
  })
})
