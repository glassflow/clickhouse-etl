import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { getPipelineListColumns } from './pipelineListColumns'
import type { ListPipelineConfig } from '@/src/types/pipeline'

vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }))
vi.mock('@/src/images/loader-small.svg', () => ({ default: 'loader.svg' }))

const baseConfig = {
  isPipelineLoading: () => false,
  getPipelineOperation: () => null,
  getEffectiveStatus: (p: ListPipelineConfig) => p.status as any,
  onStop: vi.fn(),
  onResume: vi.fn(),
  onEdit: vi.fn(),
  onRename: vi.fn(),
  onTerminate: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
  onManageTags: vi.fn(),
  onToggleSelect: vi.fn(),
  isSelected: () => false,
}

function renderCell(
  columnKey: string,
  pipeline: Partial<ListPipelineConfig>,
) {
  const pipeline_ = {
    pipeline_id: 'p1',
    name: 'Test Pipeline',
    transformation_type: 'Ingest Only',
    created_at: '2024-01-01T00:00:00Z',
    status: 'active',
    ...pipeline,
  } as ListPipelineConfig
  const columns = getPipelineListColumns(baseConfig)
  const col = columns.find((c) => c.key === columnKey)!
  const { container } = render(<div>{col.render!(pipeline_)}</div>)
  return container
}

describe('checkbox column', () => {
  it('renders a checkbox', () => {
    const container = renderCell('select', {})
    expect(container.querySelector('input[type="checkbox"]')).toBeTruthy()
  })

  it('calls onToggleSelect on click and stops propagation', () => {
    const onToggleSelect = vi.fn()
    const columns = getPipelineListColumns({ ...baseConfig, onToggleSelect })
    const col = columns.find((c) => c.key === 'select')!
    const pipeline = { pipeline_id: 'p1', name: 'T', transformation_type: 'Ingest Only', created_at: '', status: 'active' } as ListPipelineConfig
    const { container } = render(<div>{col.render!(pipeline)}</div>)
    fireEvent.click(container.querySelector('input[type="checkbox"]')!)
    expect(onToggleSelect).toHaveBeenCalledWith('p1')
  })
})

describe('status column — dot + label', () => {
  it('renders a status dot span with data-status attribute', () => {
    const container = renderCell('status', { status: 'active' })
    const dot = container.querySelector('[data-status]')
    expect(dot).toBeTruthy()
    expect(dot!.getAttribute('data-status')).toBe('active')
  })

  it('does not render a Badge component (no rounded-xl class)', () => {
    const container = renderCell('status', { status: 'active' })
    const badge = container.querySelector('.rounded-xl')
    expect(badge).toBeNull()
  })
})

describe('type glyphs', () => {
  it('Ingest Only → only I glyph', () => {
    const container = renderCell('operations', { transformation_type: 'Ingest Only' })
    expect(container.textContent).toContain('I')
    expect(container.textContent).not.toContain('D')
    expect(container.textContent).not.toContain('J')
  })

  it('Deduplication → I and D glyphs', () => {
    const container = renderCell('operations', { transformation_type: 'Deduplication' })
    expect(container.textContent).toContain('I')
    expect(container.textContent).toContain('D')
  })

  it('Join → I and J glyphs', () => {
    const container = renderCell('operations', { transformation_type: 'Join' })
    expect(container.textContent).toContain('I')
    expect(container.textContent).toContain('J')
  })

  it('Join & Deduplication → I, J, and D glyphs', () => {
    const container = renderCell('operations', { transformation_type: 'Join & Deduplication' })
    expect(container.textContent).toContain('I')
    expect(container.textContent).toContain('J')
    expect(container.textContent).toContain('D')
  })
})

const dlqStats = (n: number) => ({
  total_messages: n,
  unconsumed_messages: n,
  last_received_at: null,
  last_consumed_at: null,
})

describe('DLQ column coloring', () => {
  it('0 events → neutral faded class', () => {
    const container = renderCell('dlqStats', { dlq_stats: dlqStats(0) })
    expect(container.querySelector('[class*="neutral-faded"]')).toBeTruthy()
  })

  it('50 events → warning class', () => {
    const container = renderCell('dlqStats', { dlq_stats: dlqStats(50) })
    expect(container.querySelector('[class*="warning"]')).toBeTruthy()
  })

  it('100 events → critical class', () => {
    const container = renderCell('dlqStats', { dlq_stats: dlqStats(100) })
    expect(container.querySelector('[class*="critical"]')).toBeTruthy()
  })
})

describe('name column sub-line', () => {
  it('shows DLQ sub-line when health is unstable and DLQ > 0', () => {
    const container = renderCell('name', {
      health_status: 'unstable',
      dlq_stats: dlqStats(5),
    })
    expect(container.textContent).toContain('events in DLQ')
  })

  it('hides sub-line when health is stable', () => {
    const container = renderCell('name', {
      health_status: 'stable',
      dlq_stats: dlqStats(5),
    })
    expect(container.textContent).not.toContain('events in DLQ')
  })

  it('hides sub-line when DLQ is 0', () => {
    const container = renderCell('name', {
      health_status: 'unstable',
      dlq_stats: dlqStats(0),
    })
    expect(container.textContent).not.toContain('events in DLQ')
  })
})
