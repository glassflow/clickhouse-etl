import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DedupConfigDetail } from './DedupConfigDetail'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }))

const mockConfig: LibraryDedupConfig = {
  id: 'dedup-1', name: 'Order dedup', description: 'Removes duplicate orders',
  folderId: null, tags: ['production'],
  keyFields: ['orderId'], secondaryKeyFields: [],
  windowDuration: '10m', windowType: 'tumbling',
  timeAttribute: 'event_time', onDuplicate: 'keep_first',
  lateEventPolicy: 'pass_through', stateBackend: 'nats-kv',
  latestVersion: 'v2', usedByCount: 2, hasDrift: false,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
}
const mockUsedBy: UsedByEntry[] = [
  { pipelineId: 'p1', pipelineName: 'Prod ingest', health: 'ok', status: 'active', drift: false },
]

describe('DedupConfigDetail', () => {
  it('renders config name as heading', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order dedup')
  })

  it('shows key fields', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getAllByText('orderId').length).toBeGreaterThan(0)
  })

  it('shows window type and duration kv-rows', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Window type/i)).toBeInTheDocument()
    expect(screen.getAllByText('tumbling').length).toBeGreaterThan(0)
    expect(screen.getAllByText('10m').length).toBeGreaterThan(0)
  })

  it('renders YAML preview panel', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText(/YAML preview/i)).toBeInTheDocument()
    expect(screen.getByText(/key_fields/)).toBeInTheDocument()
  })

  it('shows used-by pipeline', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText('Prod ingest')).toBeInTheDocument()
  })

  it('shows Danger zone', () => {
    render(<DedupConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Danger zone/i)).toBeInTheDocument()
  })
})
