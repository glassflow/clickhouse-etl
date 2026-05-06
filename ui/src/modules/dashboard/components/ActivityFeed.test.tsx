import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityFeed } from './ActivityFeed'
import type { ActivityItem } from '../types'

const items: ActivityItem[] = [
  { kind: 'deploy', text: 'deployed orders-to-clickhouse v12', actor: 'maria.a', pipelineName: 'orders-to-clickhouse', relativeTime: '14m ago' },
  { kind: 'fail',   text: 'insert failed', pipelineName: 'stripe-payments-cdc', relativeTime: '2m' },
  { kind: 'pause',  text: 'paused test-events-staging', actor: 'vanessa.c', relativeTime: '5h ago' },
  { kind: 'info',   text: 'Schema orders.v4 drift detected', relativeTime: '2h ago' },
]

describe('ActivityFeed', () => {
  it('renders all activity rows', () => {
    render(<ActivityFeed items={items} />)
    expect(screen.getByText(/deployed orders-to-clickhouse v12/)).toBeInTheDocument()
    expect(screen.getByText(/insert failed/)).toBeInTheDocument()
  })

  it('renders relative timestamps', () => {
    render(<ActivityFeed items={items} />)
    expect(screen.getByText('14m ago')).toBeInTheDocument()
    expect(screen.getByText('2m')).toBeInTheDocument()
  })

  it('renders deploy dot for deploy events', () => {
    const { container } = render(<ActivityFeed items={[items[0]]} />)
    expect(container.querySelector('.activity-dot.deploy')).not.toBeNull()
  })

  it('renders fail dot for fail events', () => {
    const { container } = render(<ActivityFeed items={[items[1]]} />)
    expect(container.querySelector('.activity-dot.fail')).not.toBeNull()
  })

  it('renders pause dot for pause events', () => {
    const { container } = render(<ActivityFeed items={[items[2]]} />)
    expect(container.querySelector('.activity-dot.pause')).not.toBeNull()
  })

  it('renders info dot for info events', () => {
    const { container } = render(<ActivityFeed items={[items[3]]} />)
    expect(container.querySelector('.activity-dot.info')).not.toBeNull()
  })
})
