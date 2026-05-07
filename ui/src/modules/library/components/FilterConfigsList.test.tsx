import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FilterConfigsList } from './FilterConfigsList'
import type { LibraryFilterConfig } from '@/src/hooks/useLibraryConnections'

const mockConfigs: LibraryFilterConfig[] = [
  {
    id: 'filter-1', name: 'High-value orders', description: null,
    folderId: null, tags: [],
    boundSchemaId: null,
    rules: [{ id: 'r1', field: 'amount', operator: 'gt', value: '1000' }],
    latestVersion: 'v1', usedByCount: 2,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'filter-2', name: 'Error events', description: null,
    folderId: null, tags: [],
    boundSchemaId: null,
    rules: [{ id: 'g1', combinator: 'or', rules: [] } as any],
    latestVersion: 'v3', usedByCount: 4,
    createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  },
]

describe('FilterConfigsList', () => {
  it('renders a card for each config', () => {
    render(<FilterConfigsList configs={mockConfigs} />)
    expect(screen.getByText('High-value orders')).toBeInTheDocument()
    expect(screen.getByText('Error events')).toBeInTheDocument()
  })

  it('shows version badge', () => {
    render(<FilterConfigsList configs={mockConfigs} />)
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('each card links to /library/filter/[id]', () => {
    render(<FilterConfigsList configs={mockConfigs} />)
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href') === '/library/filter/filter-1')).toBe(true)
  })

  it('renders empty state when no configs', () => {
    render(<FilterConfigsList configs={[]} />)
    expect(screen.getByText(/No filter configs/i)).toBeInTheDocument()
  })
})
