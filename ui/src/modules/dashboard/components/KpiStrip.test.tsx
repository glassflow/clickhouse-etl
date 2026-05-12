import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiStrip } from './KpiStrip'
import type { DashStats } from '../types'

const stats: DashStats = {
  activePipelines: 14,
  totalPipelines: 16,
  eventsPerSec: 42600,
  eventsPerSecDelta: 8.2,
  errorRate: 0.34,
  errorRateDelta: 0.21,
  dlqEvents: 2847,
  dlqDelta: 412,
  avgLagMs: 1200,
  avgLagMsDelta: 0,
  throughputIn: 0,
  throughputOut: 0,
  throughputLossPct: 0,
  throughputSeries: { in: [], out: [] },
}

describe('KpiStrip', () => {
  it('renders all 5 KPI labels', () => {
    render(<KpiStrip stats={stats} />)
    expect(screen.getByText(/Active pipelines/i)).toBeInTheDocument()
    expect(screen.getByText(/Events \/ sec/i)).toBeInTheDocument()
    expect(screen.getByText(/Error rate/i)).toBeInTheDocument()
    expect(screen.getByText(/DLQ events/i)).toBeInTheDocument()
    expect(screen.getByText(/Avg lag/i)).toBeInTheDocument()
  })

  it('shows pipeline count as "14 / 16"', () => {
    render(<KpiStrip stats={stats} />)
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('/ 16')).toBeInTheDocument()
  })

  it('applies warn severity when error rate > 0.1%', () => {
    const { container } = render(<KpiStrip stats={{ ...stats, errorRate: 0.5 }} />)
    expect(container.querySelector('[data-severity="warn"]')).not.toBeNull()
  })

  it('applies crit severity when error rate > 1%', () => {
    const { container } = render(<KpiStrip stats={{ ...stats, errorRate: 2.5 }} />)
    expect(container.querySelector('[data-severity="crit"]')).not.toBeNull()
  })

  it('applies crit severity when DLQ > 1000', () => {
    const { container } = render(<KpiStrip stats={{ ...stats, dlqEvents: 1500 }} />)
    const critCards = container.querySelectorAll('[data-severity="crit"]')
    expect(critCards.length).toBeGreaterThan(0)
  })

  it('shows delta with up direction for positive events/sec delta', () => {
    const { container } = render(<KpiStrip stats={{ ...stats, eventsPerSecDelta: 8.2 }} />)
    expect(container.querySelector('[data-direction="up"]')).not.toBeNull()
  })
})
