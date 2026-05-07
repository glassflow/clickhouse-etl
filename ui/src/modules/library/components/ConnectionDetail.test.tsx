import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionDetail } from './ConnectionDetail'
import type { LibraryConnection } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }))

const mockConn: LibraryConnection = {
  id: 'c1', kind: 'kafka', name: 'Prod Kafka',
  description: 'Main cluster', folderId: null, tags: [],
  config: { bootstrapServers: 'kafka:9092', authMethod: 'sasl_plain', username: 'user', password: 'secret' },
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
}
const mockUsedBy: UsedByEntry[] = [
  { pipelineId: 'p1', pipelineName: 'Ingest', health: 'ok', status: 'active', drift: false },
]

describe('ConnectionDetail', () => {
  it('renders connection name as heading', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Prod Kafka')
  })

  it('shows bootstrapServers as a kv-row label', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Bootstrap servers/i)).toBeInTheDocument()
  })

  it('masks password field', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByText(/••••/)).toBeInTheDocument()
  })

  it('renders used-by pill for each pipeline', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByText('Ingest')).toBeInTheDocument()
  })

  it('renders Health panel', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Health/i)).toBeInTheDocument()
  })

  it('renders Danger zone section', () => {
    render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Danger zone/i)).toBeInTheDocument()
  })

  it('does NOT render a raw JSON pre block', () => {
    const { container } = render(<ConnectionDetail connection={mockConn} usedBy={mockUsedBy} />)
    expect(container.querySelector('pre')).toBeNull()
  })
})
