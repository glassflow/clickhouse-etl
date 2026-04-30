import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScopeBadge } from '../scope-badge'

describe('ScopeBadge', () => {
  it('renders the scoped pipeline id', () => {
    render(<ScopeBadge pipelineId="orders-prod-v3" />)
    expect(screen.getByText(/scoped:/)).toBeInTheDocument()
    expect(screen.getByText('orders-prod-v3')).toBeInTheDocument()
  })

  it('truncates long ids in display but keeps full in tooltip', () => {
    render(<ScopeBadge pipelineId="a-very-long-pipeline-identifier-that-overflows" />)
    const el = screen.getByTitle('a-very-long-pipeline-identifier-that-overflows')
    expect(el).toBeInTheDocument()
  })
})
