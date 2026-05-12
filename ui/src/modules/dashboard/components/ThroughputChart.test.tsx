import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThroughputChart } from './ThroughputChart'
import type { DashStats } from '../types'

const stats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 0, eventsPerSecDelta: 0,
  errorRate: 0, errorRateDelta: 0,
  dlqEvents: 0, dlqDelta: 0,
  avgLagMs: 0, avgLagMsDelta: 0,
  throughputIn: 153400000,
  throughputOut: 152800000,
  throughputLossPct: 0.39,
  throughputSeries: {
    in: Array.from({ length: 60 }, (_, i) => 720 + i),
    out: Array.from({ length: 60 }, (_, i) => 702 + i),
  },
}

describe('ThroughputChart', () => {
  it('renders card title "Throughput"', () => {
    render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(screen.getByText('Throughput')).toBeInTheDocument()
  })

  it('renders "Open in observability" link', () => {
    render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(screen.getByText(/Open in observability/)).toBeInTheDocument()
  })

  it('renders In totals label', () => {
    render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(screen.getByText(/In · last hour/i)).toBeInTheDocument()
  })

  it('renders Out totals label', () => {
    render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(screen.getByText(/Out · last hour/i)).toBeInTheDocument()
  })

  it('renders an SVG chart element', () => {
    const { container } = render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('shows "with incident overlay" in incident state', () => {
    render(<ThroughputChart stats={stats} isIncidentState={true} />)
    expect(screen.getByText(/with incident overlay/)).toBeInTheDocument()
  })

  it('applies crit severity to loss when loss > 10%', () => {
    const { container } = render(<ThroughputChart stats={{ ...stats, throughputLossPct: 13.7 }} isIncidentState={false} />)
    expect(container.querySelector('[data-severity="crit"]')).not.toBeNull()
  })

  it('applies warn severity to loss when loss > 1%', () => {
    const { container } = render(<ThroughputChart stats={{ ...stats, throughputLossPct: 2.5 }} isIncidentState={false} />)
    expect(container.querySelector('[data-severity="warn"]')).not.toBeNull()
  })
})
