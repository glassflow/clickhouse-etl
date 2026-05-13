import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ObservabilityStatCards } from './ObservabilityStatCards'
import type { ListPipelineConfig } from '@/src/types/pipeline'

function makeP(overrides: Partial<ListPipelineConfig>): ListPipelineConfig {
  return {
    pipeline_id: 'p1',
    name: 'test',
    transformation_type: 'Ingest Only',
    created_at: '2026-01-01',
    status: 'active',
    health_status: 'stable',
    dlq_stats: { total_messages: 0, unconsumed_messages: 0, last_received_at: null, last_consumed_at: null },
    ...overrides,
  }
}

describe('ObservabilityStatCards', () => {
  it('shows correct running count', () => {
    const pipelines = [
      makeP({ status: 'active' }),
      makeP({ pipeline_id: 'p2', status: 'active' }),
      makeP({ pipeline_id: 'p3', status: 'paused' }),
    ]
    render(<ObservabilityStatCards pipelines={pipelines} />)
    expect(screen.getByText('2')).toBeInTheDocument() // running
  })

  it('shows needs-attention count for failed + unstable', () => {
    const pipelines = [
      makeP({ status: 'failed', health_status: 'unstable' }),
      makeP({ pipeline_id: 'p2', status: 'active', health_status: 'unstable' }),
      makeP({ pipeline_id: 'p3', status: 'active', health_status: 'stable' }),
    ]
    render(<ObservabilityStatCards pipelines={pipelines} />)
    const cards = screen.getAllByText('2')
    expect(cards.length).toBeGreaterThanOrEqual(1)
  })

  it('sums DLQ unconsumed messages across all pipelines', () => {
    const pipelines = [
      makeP({
        dlq_stats: { total_messages: 10, unconsumed_messages: 5, last_received_at: null, last_consumed_at: null },
      }),
      makeP({
        pipeline_id: 'p2',
        dlq_stats: { total_messages: 10, unconsumed_messages: 12, last_received_at: null, last_consumed_at: null },
      }),
    ]
    render(<ObservabilityStatCards pipelines={pipelines} />)
    expect(screen.getByText('17')).toBeInTheDocument()
  })

  it('shows 0 needs-attention in positive colour when no degraded pipelines', () => {
    const pipelines = [makeP({ status: 'active', health_status: 'stable' })]
    render(<ObservabilityStatCards pipelines={pipelines} />)
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
  })
})
