import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ObservabilityFleetRow } from './ObservabilityFleetRow'
import type { ListPipelineConfig } from '@/src/types/pipeline'

const BASE_PIPELINE: ListPipelineConfig = {
  pipeline_id: 'pipe-abc',
  name: 'my-pipeline',
  transformation_type: 'Ingest Only',
  created_at: '2026-01-01',
  status: 'active',
  health_status: 'stable',
  dlq_stats: { total_messages: 0, unconsumed_messages: 0, last_received_at: null, last_consumed_at: null },
}

const ROW_PROPS = {
  pipeline: BASE_PIPELINE,
  fromMs: 1700000000000,
  toMs: 1700003600000,
  step: '15s' as const,
  autoRefreshIntervalMs: null as null,
  isLast: false,
}

describe('ObservabilityFleetRow', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: { resultType: 'matrix', result: [{ metric: {}, values: [[1700000000, '100']] }] },
        }),
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders pipeline name as a link to /metrics', () => {
    render(
      <table>
        <tbody>
          <ObservabilityFleetRow {...ROW_PROPS} />
        </tbody>
      </table>,
    )
    const link = screen.getByRole('link', { name: /my-pipeline/i })
    expect(link).toHaveAttribute('href', '/pipelines/pipe-abc/metrics')
  })

  it('renders StatusBadge for the pipeline status', () => {
    render(
      <table>
        <tbody>
          <ObservabilityFleetRow {...ROW_PROPS} />
        </tbody>
      </table>,
    )
    expect(screen.getByText(/active/i)).toBeInTheDocument()
  })

  it('skips VM queries and renders dashes for paused pipelines', () => {
    const paused = { ...ROW_PROPS, pipeline: { ...BASE_PIPELINE, status: 'paused' as const } }
    render(
      <table>
        <tbody>
          <ObservabilityFleetRow {...paused} />
        </tbody>
      </table>,
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2) // throughput + errors
    expect(fetch).not.toHaveBeenCalled()
  })

  it('links DLQ cell to /dlq when dlq > 0', () => {
    const withDlq = {
      ...ROW_PROPS,
      pipeline: {
        ...BASE_PIPELINE,
        dlq_stats: { total_messages: 50, unconsumed_messages: 47, last_received_at: null, last_consumed_at: null },
        health_status: 'unstable' as const,
      },
    }
    render(
      <table>
        <tbody>
          <ObservabilityFleetRow {...withDlq} />
        </tbody>
      </table>,
    )
    const dlqLink = screen.getByRole('link', { name: '47' })
    expect(dlqLink).toHaveAttribute('href', '/pipelines/pipe-abc/dlq')
  })

  it('links DLQ cell to /metrics when dlq is 0', () => {
    render(
      <table>
        <tbody>
          <ObservabilityFleetRow {...ROW_PROPS} />
        </tbody>
      </table>,
    )
    const dlqCell = screen.getByText('0')
    expect(dlqCell.closest('a')).toHaveAttribute('href', '/pipelines/pipe-abc/metrics')
  })

  it('links error cell to /logs when errors.latest > 0', async () => {
    // fetch stub from beforeEach returns values: [[..., '100']], so latest = 100 > 0
    render(
      <table>
        <tbody>
          <ObservabilityFleetRow {...ROW_PROPS} />
        </tbody>
      </table>,
    )
    await waitFor(() => {
      const logsLinks = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.endsWith('/logs'))
      expect(logsLinks.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('links error cell to /metrics when errors are zero', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ result: { resultType: 'matrix', result: [{ metric: {}, values: [[1700000000, '0']] }] } }),
    } as Response)

    render(
      <table>
        <tbody>
          <ObservabilityFleetRow {...ROW_PROPS} />
        </tbody>
      </table>,
    )
    await waitFor(() => {
      // all links in the row should point to /metrics, not /logs
      const allLinks = screen.getAllByRole('link')
      const logLinks = allLinks.filter((l) => l.getAttribute('href')?.endsWith('/logs'))
      expect(logLinks.length).toBe(0)
    })
  })
})
