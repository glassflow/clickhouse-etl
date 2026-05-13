import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ObservabilityFleetTable } from './ObservabilityFleetTable'
import type { ListPipelineConfig } from '@/src/types/pipeline'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { resultType: 'matrix', result: [] } }),
    }),
  )
})

function makeP(id: string, status: string, dlq = 0): ListPipelineConfig {
  return {
    pipeline_id: id,
    name: `pipeline-${id}`,
    transformation_type: 'Ingest Only',
    created_at: '2026-01-01',
    status: status as ListPipelineConfig['status'],
    health_status: status === 'failed' ? 'unstable' : 'stable',
    dlq_stats: { total_messages: dlq, unconsumed_messages: dlq, last_received_at: null, last_consumed_at: null },
  }
}

const PIPELINES = [makeP('a', 'active', 0), makeP('b', 'failed', 10), makeP('c', 'paused', 0), makeP('d', 'active', 0)]

const TABLE_PROPS = {
  pipelines: PIPELINES,
  fromMs: 1700000000000,
  toMs: 1700003600000,
  step: '15s' as const,
  autoRefreshIntervalMs: null as null,
}

describe('ObservabilityFleetTable', () => {
  it('renders all pipelines by default', () => {
    render(<ObservabilityFleetTable {...TABLE_PROPS} />)
    expect(screen.getByText('pipeline-a')).toBeInTheDocument()
    expect(screen.getByText('pipeline-b')).toBeInTheDocument()
    expect(screen.getByText('pipeline-c')).toBeInTheDocument()
    expect(screen.getByText('pipeline-d')).toBeInTheDocument()
  })

  it('renders empty state when pipelines is empty', () => {
    render(<ObservabilityFleetTable {...TABLE_PROPS} pipelines={[]} />)
    expect(screen.getByText(/no pipelines/i)).toBeInTheDocument()
  })

  it('shows pipeline count in table caption', () => {
    render(<ObservabilityFleetTable {...TABLE_PROPS} />)
    expect(screen.getByText(/all pipelines \(4\)/i)).toBeInTheDocument()
  })
})
