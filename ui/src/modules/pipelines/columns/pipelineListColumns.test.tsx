import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { getPipelineListColumns } from './pipelineListColumns'
import type { ListPipelineConfig } from '@/src/types/pipeline'

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: unknown }) => <img src={String(src)} alt={alt} />,
}))

vi.mock('@/src/modules/pipelines/TableContextMenu', () => ({
  TableContextMenu: () => <div data-testid="table-context-menu">Actions</div>,
}))

const mockPipeline: ListPipelineConfig = {
  pipeline_id: 'p1',
  name: 'Test Pipeline',
  transformation_type: 'Deduplication',
  created_at: '2024-01-01T00:00:00Z',
  status: 'active',
}

function getConfig() {
  return {
    isPipelineLoading: vi.fn(() => false),
    getPipelineOperation: vi.fn(() => null),
    getEffectiveStatus: vi.fn((p: ListPipelineConfig) => (p.status as string) ?? 'active'),
    onStop: vi.fn(),
    onResume: vi.fn(),
    onEdit: vi.fn(),
    onRename: vi.fn(),
    onTerminate: vi.fn(),
    onDelete: vi.fn(),
    onDownload: vi.fn(),
    onManageTags: vi.fn(),
  }
}

describe('getPipelineListColumns', () => {
  it('returns array with expected length', () => {
    const columns = getPipelineListColumns(getConfig())
    expect(columns).toHaveLength(8)
  })

  it('returns columns with expected keys and headers', () => {
    const columns = getPipelineListColumns(getConfig())
    const keys = columns.map((c) => c.key)
    const headers = columns.map((c) => c.header)

    expect(keys).toEqual([
      'name',
      'operations',
      'tags',
      'health',
      'dlqStats',
      'status',
      'created_at',
      'actions',
    ])
    expect(headers).toEqual([
      'Name',
      'Transformation',
      'Tags',
      'Health',
      'Events in DLQ',
      'Status',
      'Created',
      'Actions',
    ])
  })

  it('status column render uses getEffectiveStatus and displays status label', () => {
    const config = getConfig()
    config.getEffectiveStatus.mockReturnValue('active')
    const columns = getPipelineListColumns(config)
    const statusColumn = columns.find((c) => c.key === 'status')
    expect(statusColumn).toBeDefined()
    expect(statusColumn?.render).toBeDefined()

    const { container } = render(statusColumn!.render!(mockPipeline))
    expect(container.textContent).toContain('Active')
  })

  it('status column render shows label for paused status', () => {
    const config = getConfig()
    config.getEffectiveStatus.mockReturnValue('paused')
    const columns = getPipelineListColumns(config)
    const statusColumn = columns.find((c) => c.key === 'status')
    const { container } = render(statusColumn!.render!(mockPipeline))
    expect(container.textContent).toContain('Paused')
  })

  it('name column render uses pipeline name and isPipelineLoading', () => {
    const config = getConfig()
    const columns = getPipelineListColumns(config)
    const nameColumn = columns.find((c) => c.key === 'name')
    const { container } = render(nameColumn!.render!(mockPipeline))
    expect(container.textContent).toContain('Test Pipeline')
  })

  it('operations column render returns transformation_type', () => {
    const columns = getPipelineListColumns(getConfig())
    const opsColumn = columns.find((c) => c.key === 'operations')
    const { container } = render(opsColumn!.render!(mockPipeline))
    expect(container.textContent).toContain('Deduplication')
  })
})
