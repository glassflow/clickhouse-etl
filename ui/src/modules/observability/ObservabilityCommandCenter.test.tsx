import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ObservabilityCommandCenter } from './ObservabilityCommandCenter'

const MOCK_PIPELINES = [
  {
    pipeline_id: 'p1',
    name: 'prod-orders',
    transformation_type: 'Ingest Only',
    created_at: '2026-01-01',
    status: 'active',
    health_status: 'stable',
    dlq_stats: { total_messages: 0, unconsumed_messages: 0, last_received_at: null, last_consumed_at: null },
  },
  {
    pipeline_id: 'p2',
    name: 'analytics-stream',
    transformation_type: 'Ingest Only',
    created_at: '2026-01-01',
    status: 'failed',
    health_status: 'unstable',
    dlq_stats: { total_messages: 50, unconsumed_messages: 47, last_received_at: null, last_consumed_at: null },
  },
]

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      // Pipeline list endpoint
      if (url === '/ui-api/pipeline' || url.endsWith('/ui-api/pipeline')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, pipelines: MOCK_PIPELINES }) })
      }
      // Individual pipeline health endpoint
      if (url.includes('/health')) {
        return Promise.resolve({ ok: true, json: async () => ({ overall_status: 'active' }) })
      }
      // Individual pipeline endpoint
      if (url.includes('/ui-api/pipeline/p1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            pipeline: { ...MOCK_PIPELINES[0], source: { kafka: {} }, sink: { clickhouse: {} } },
          }),
        })
      }
      if (url.includes('/ui-api/pipeline/p2')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            pipeline: { ...MOCK_PIPELINES[1], source: { kafka: {} }, sink: { clickhouse: {} } },
          }),
        })
      }
      // DLQ endpoint
      if (url.includes('/dlq')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            total_messages: 0,
            unconsumed_messages: 0,
            last_received_at: null,
            last_consumed_at: null,
          }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ result: { resultType: 'matrix', result: [] } }) })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('ObservabilityCommandCenter', () => {
  it('renders page title', async () => {
    render(<ObservabilityCommandCenter />)
    expect(screen.getByText('Observability')).toBeInTheDocument()
  })

  it('shows loading state then pipeline names', async () => {
    render(<ObservabilityCommandCenter />)
    await waitFor(() => expect(screen.getByText('prod-orders')).toBeInTheDocument())
    expect(screen.getByText('analytics-stream')).toBeInTheDocument()
  })

  it('time range buttons are rendered', async () => {
    render(<ObservabilityCommandCenter />)
    expect(screen.getByRole('button', { name: /1h/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /6h/i })).toBeInTheDocument()
  })

  it('renders stat cards', async () => {
    render(<ObservabilityCommandCenter />)
    await waitFor(() => expect(screen.getByText('Running')).toBeInTheDocument())
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText('DLQ backlog')).toBeInTheDocument()
  })

  it('renders all four time range buttons', async () => {
    render(<ObservabilityCommandCenter />)
    expect(screen.getByRole('button', { name: /15m/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1h/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /6h/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /24h/i })).toBeInTheDocument()
  })

  it('renders all auto-refresh options', async () => {
    render(<ObservabilityCommandCenter />)
    expect(screen.getByRole('button', { name: /off/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /30s/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /60s/i })).toBeInTheDocument()
  })

  it('renders status filter pills after data loads', async () => {
    render(<ObservabilityCommandCenter />)
    await waitFor(() => expect(screen.getByText(/all \(2\)/i)).toBeInTheDocument())
    expect(screen.getByText(/active \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/degraded \(1\)/i)).toBeInTheDocument()
  })
})
