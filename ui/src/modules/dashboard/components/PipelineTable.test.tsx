import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelineTable } from './PipelineTable'
import type { DashPipeline } from '../types'

const pipelines: DashPipeline[] = [
  { id: 'p1', name: 'orders-to-clickhouse', version: 'v12', sourceTopic: 'orders.events', destTable: 'analytics.orders', status: 'run',    statusLabel: 'running',  throughput: '8.4k', throughputUnit: '/s', lagP95: '420', lagUnit: 'ms', dlq: '0',   lastDeploy: '2d ago', deployedBy: 'maria.a' },
  { id: 'p2', name: 'stripe-payments-cdc',  version: 'v6',  sourceTopic: 'stripe.cdc',    destTable: 'fin.payments',     status: 'paused', statusLabel: 'paused',   throughput: '—',    throughputUnit: '',   lagP95: '—',   lagUnit: '',   dlq: '—',   lastDeploy: '3h ago', deployedBy: 'daniel.k' },
  { id: 'p3', name: 'broken-pipeline',      version: 'v1',  sourceTopic: 'src.topic',     destTable: 'dest.table',       status: 'fail',   statusLabel: 'failing',  throughput: '0',    throughputUnit: '/s', lagP95: '30',  lagUnit: 's',  dlq: '500', dlqSeverity: 'crit', lastDeploy: '1h ago', deployedBy: 'system' },
]

describe('PipelineTable', () => {
  it('renders all pipeline names', () => {
    render(<PipelineTable pipelines={pipelines} />)
    expect(screen.getByText('orders-to-clickhouse')).toBeInTheDocument()
    expect(screen.getByText('stripe-payments-cdc')).toBeInTheDocument()
    expect(screen.getByText('broken-pipeline')).toBeInTheDocument()
  })

  it('renders All filter button as active by default', () => {
    const { container } = render(<PipelineTable pipelines={pipelines} />)
    const activeBtn = container.querySelector('[aria-pressed="true"]')
    expect(activeBtn?.textContent).toContain('All')
  })

  it('filters to running pipelines when Running chip clicked', () => {
    render(<PipelineTable pipelines={pipelines} />)
    fireEvent.click(screen.getByText(/^Running/))
    expect(screen.getByText('orders-to-clickhouse')).toBeInTheDocument()
    expect(screen.queryByText('stripe-payments-cdc')).not.toBeInTheDocument()
  })

  it('filters to paused pipelines when Paused chip clicked', () => {
    render(<PipelineTable pipelines={pipelines} />)
    fireEvent.click(screen.getByText(/^Paused/))
    expect(screen.getByText('stripe-payments-cdc')).toBeInTheDocument()
    expect(screen.queryByText('orders-to-clickhouse')).not.toBeInTheDocument()
  })

  it('shows run status chip', () => {
    const { container } = render(<PipelineTable pipelines={[pipelines[0]]} />)
    expect(container.querySelector('[data-status="run"]')).not.toBeNull()
  })

  it('shows fail status chip', () => {
    const { container } = render(<PipelineTable pipelines={[pipelines[2]]} />)
    expect(container.querySelector('[data-status="fail"]')).not.toBeNull()
  })

  it('applies crit severity to DLQ cell when dlqSeverity is crit', () => {
    const { container } = render(<PipelineTable pipelines={[pipelines[2]]} />)
    expect(container.querySelector('[data-severity="crit"]')).not.toBeNull()
  })

  it('shows version badge next to pipeline name', () => {
    render(<PipelineTable pipelines={[pipelines[0]]} />)
    expect(screen.getByText('v12')).toBeInTheDocument()
  })
})
