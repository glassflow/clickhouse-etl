import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FilterConfigDetail } from './FilterConfigDetail'
import type { LibraryFilterConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }))

const mockConfig: LibraryFilterConfig = {
  id: 'filter-1', name: 'High-value orders', description: 'Orders > 1000',
  folderId: null, tags: [],
  boundSchemaId: null,
  rules: [{ id: 'r1', field: 'amount', operator: 'gt', value: '1000' }],
  latestVersion: 'v1', usedByCount: 2,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
}
const mockUsedBy: UsedByEntry[] = [
  { pipelineId: 'p1', pipelineName: 'Prod orders', health: 'ok', status: 'active', drift: false },
]

describe('FilterConfigDetail', () => {
  it('renders config name as heading', () => {
    render(<FilterConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('High-value orders')
  })

  it('shows filter rule field and operator', () => {
    render(<FilterConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText('amount')).toBeInTheDocument()
    expect(screen.getByText('gt')).toBeInTheDocument()
  })

  it('shows used-by pipeline', () => {
    render(<FilterConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText('Prod orders')).toBeInTheDocument()
  })

  it('shows Danger zone', () => {
    render(<FilterConfigDetail config={mockConfig} usedBy={mockUsedBy} />)
    expect(screen.getByText(/Danger zone/i)).toBeInTheDocument()
  })
})
