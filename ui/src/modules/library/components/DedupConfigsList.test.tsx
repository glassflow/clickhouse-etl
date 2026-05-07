import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DedupConfigsList } from './DedupConfigsList'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'

const mockConfigs: LibraryDedupConfig[] = [
  {
    id: 'dedup-1', name: 'Order dedup', description: null,
    folderId: null, tags: [],
    keyFields: ['orderId'], secondaryKeyFields: [],
    windowDuration: '10m', windowType: 'tumbling',
    timeAttribute: 'event_time', onDuplicate: 'keep_first',
    lateEventPolicy: 'pass_through', stateBackend: 'nats-kv',
    latestVersion: 'v2', usedByCount: 3, hasDrift: false,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'dedup-2', name: 'Click dedup', description: null,
    folderId: null, tags: [],
    keyFields: ['sessionId'], secondaryKeyFields: [],
    windowDuration: '5m', windowType: 'sliding',
    timeAttribute: 'processing_time', onDuplicate: 'keep_last',
    lateEventPolicy: 'drop', stateBackend: 'memory',
    latestVersion: 'v1', usedByCount: 1, hasDrift: true,
    createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  },
]

describe('DedupConfigsList', () => {
  it('renders a card for each config', () => {
    render(<DedupConfigsList configs={mockConfigs} />)
    expect(screen.getByText('Order dedup')).toBeInTheDocument()
    expect(screen.getByText('Click dedup')).toBeInTheDocument()
  })

  it('shows version badge', () => {
    render(<DedupConfigsList configs={mockConfigs} />)
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('shows window type chip', () => {
    render(<DedupConfigsList configs={mockConfigs} />)
    expect(screen.getByText('tumbling')).toBeInTheDocument()
    expect(screen.getByText('sliding')).toBeInTheDocument()
  })

  it('shows drift indicator for drifted config', () => {
    const { container } = render(<DedupConfigsList configs={mockConfigs} />)
    expect(container.querySelector('.schema-card-drift')).not.toBeNull()
  })

  it('each card is a link to /library/dedup/[id]', () => {
    render(<DedupConfigsList configs={mockConfigs} />)
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href') === '/library/dedup/dedup-1')).toBe(true)
  })

  it('renders empty state when no configs', () => {
    render(<DedupConfigsList configs={[]} />)
    expect(screen.getByText(/No dedup configs/i)).toBeInTheDocument()
  })
})
