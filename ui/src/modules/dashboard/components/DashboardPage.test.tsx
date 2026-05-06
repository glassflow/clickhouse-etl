import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardPage } from './DashboardPage'
import type { DashboardState, DashStats, ActivityItem } from '../types'

const stats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 42600, eventsPerSecDelta: 8.2,
  errorRate: 0.34, errorRateDelta: 0.21,
  dlqEvents: 2847, dlqDelta: 412,
  avgLagMs: 1200, avgLagMsDelta: 0,
  throughputIn: 153400000, throughputOut: 152800000, throughputLossPct: 0.39,
  throughputSeries: { in: Array(60).fill(720), out: Array(60).fill(702) },
}
const activity: ActivityItem[] = []
const pipeline = {
  id: 'p1', name: 'orders', version: 'v12', sourceTopic: 'src', destTable: 'dest',
  status: 'run' as const, statusLabel: 'running',
  throughput: '8k', throughputUnit: '/s', lagP95: '420', lagUnit: 'ms',
  dlq: '0', lastDeploy: '2d ago', deployedBy: 'alice',
}

describe('DashboardPage', () => {
  it('renders first-run state', () => {
    const state: DashboardState = { kind: 'first-run' }
    render(<DashboardPage state={state} />)
    expect(screen.getByText("Let's set up your first pipeline")).toBeInTheDocument()
  })

  it('renders "Welcome to GlassFlow" heading in first-run', () => {
    const state: DashboardState = { kind: 'first-run' }
    render(<DashboardPage state={state} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to GlassFlow')
  })

  it('renders healthy banner in healthy state', () => {
    const state: DashboardState = { kind: 'healthy', pipelines: [pipeline], stats, activity }
    render(<DashboardPage state={state} />)
    expect(screen.getByText('All pipelines healthy')).toBeInTheDocument()
  })

  it('renders KPI strip in healthy state', () => {
    const state: DashboardState = { kind: 'healthy', pipelines: [pipeline], stats, activity }
    render(<DashboardPage state={state} />)
    expect(screen.getByText(/Active pipelines/i)).toBeInTheDocument()
  })

  it('renders attention queue in populated state', () => {
    const state: DashboardState = {
      kind: 'populated', pipelines: [pipeline], stats, activity,
      incidents: [{
        id: 'i1', severity: 'crit', pipelineName: 'orders', title: 'DLQ growing',
        description: 'desc', meta: ['47m ago'], ctaLabel: 'Fix it',
      }],
    }
    render(<DashboardPage state={state} />)
    expect(screen.getByText('Needs your attention')).toBeInTheDocument()
    expect(screen.getByText('DLQ growing')).toBeInTheDocument()
  })

  it('renders pipeline table in populated state', () => {
    const state: DashboardState = {
      kind: 'populated', pipelines: [pipeline], stats, activity,
      incidents: [{ id: 'i1', severity: 'crit', pipelineName: 'stripe-cdc', title: 'x', description: 'y', meta: [], ctaLabel: 'Fix' }],
    }
    render(<DashboardPage state={state} />)
    expect(screen.getByText('Pipelines')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
  })

  it('renders throughput chart in incident state', () => {
    const state: DashboardState = {
      kind: 'incident', pipelines: [pipeline], stats, activity, incidents: [],
    }
    render(<DashboardPage state={state} />)
    expect(screen.getByRole('heading', { name: /Throughput/ })).toBeInTheDocument()
  })
})
