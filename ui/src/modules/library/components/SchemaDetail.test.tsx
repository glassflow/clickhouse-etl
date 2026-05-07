import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SchemaDetail } from './SchemaDetail'
import type { LibrarySchema } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }))
vi.mock('@/src/hooks/useLibraryDetail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/hooks/useLibraryDetail')>()
  return {
    ...actual,
    useSchemaVersions: () => ({ data: [], isLoading: false, error: undefined, mutate: vi.fn() }),
  }
})

const mockSchema: LibrarySchema = {
  id: 's1', name: 'events', description: 'Event schema',
  folderId: null, tags: [], source: 'kafka', registryUrl: null,
  fields: [
    { name: 'id', type: 'string', nullable: false },
    { name: 'ts', type: 'long', nullable: false },
  ],
  fieldCount: 2, pipelineCount: 1,
  latestVersion: 'v3', hasDrift: false, usedByCount: 1,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
}
const mockUsedBy: UsedByEntry[] = [
  { pipelineId: 'p1', pipelineName: 'Ingest', health: 'ok', status: 'active', drift: false },
]

describe('SchemaDetail', () => {
  it('renders schema name heading', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('events')
  })

  it('renders fields table with column headers', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText('Field')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Nullable')).toBeInTheDocument()
  })

  it('renders each field row', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('ts')).toBeInTheDocument()
    expect(screen.getByText('string')).toBeInTheDocument()
  })

  it('renders used-by section in main column', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText('Ingest')).toBeInTheDocument()
  })

  it('renders version badge in header', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText('v3')).toBeInTheDocument()
  })

  it('renders Danger zone in sidebar', () => {
    render(<SchemaDetail schema={mockSchema} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Danger zone/i)).toBeInTheDocument()
  })
})
