import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttentionQueue } from './AttentionQueue'
import type { Incident } from '../types'

const incidents: Incident[] = [
  {
    id: 'i1', severity: 'crit', pipelineName: 'orders-to-clickhouse',
    title: 'DLQ growing — schema mismatch on user_id',
    description: '412 events failed in the last hour.',
    meta: ['started 47m ago', '412 events'],
    ctaLabel: 'Fix it',
  },
  {
    id: 'i2', severity: 'warn', pipelineName: 'events-stream-prod',
    title: 'Schema drift detected',
    description: 'Source has added 2 new fields.',
    meta: ['detected 2h ago'],
    ctaLabel: 'Review drift',
  },
]

describe('AttentionQueue', () => {
  it('renders all incident rows', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(screen.getByText('DLQ growing — schema mismatch on user_id')).toBeInTheDocument()
    expect(screen.getByText('Schema drift detected')).toBeInTheDocument()
  })

  it('renders pipeline name tags', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(screen.getAllByText('orders-to-clickhouse')).toHaveLength(1)
  })

  it('renders CTA buttons', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(screen.getByRole('button', { name: 'Fix it' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review drift' })).toBeInTheDocument()
  })

  it('shows incident count in header', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(screen.getByText('2 incidents')).toBeInTheDocument()
  })

  it('shows "Sort by impact" label in incident state', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={true} />)
    expect(screen.getByText(/Sort by impact/)).toBeInTheDocument()
  })

  it('applies crit severity to critical incident row', () => {
    const { container } = render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(container.querySelector('[data-severity="crit"]')).not.toBeNull()
  })

  it('applies warn severity to warning incident row', () => {
    const { container } = render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(container.querySelector('[data-severity="warn"]')).not.toBeNull()
  })
})
