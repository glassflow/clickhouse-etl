import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelinesTable } from './PipelinesTable'
import type { ListPipelineConfig } from '@/src/types/pipeline'
import type { TableColumn } from './PipelinesTable'

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="img">{alt}</span>,
}))

vi.mock('@/src/images/sort.svg', () => ({ default: 'sort.svg' }))
vi.mock('@/src/images/sort-up.svg', () => ({ default: 'sort-up.svg' }))
vi.mock('@/src/images/sort-down.svg', () => ({ default: 'sort-down.svg' }))

const mockData: ListPipelineConfig[] = [
  {
    pipeline_id: 'p1',
    name: 'Alpha Pipeline',
    transformation_type: 'Deduplication',
    created_at: '2024-01-03T00:00:00Z',
    status: 'stopped',
  },
  {
    pipeline_id: 'p2',
    name: 'Beta Pipeline',
    transformation_type: 'Join',
    created_at: '2024-01-01T00:00:00Z',
    status: 'active',
  },
  {
    pipeline_id: 'p3',
    name: 'Gamma Pipeline',
    transformation_type: 'Deduplication',
    created_at: '2024-01-02T00:00:00Z',
    status: 'paused',
  },
]

const sortableColumns: TableColumn<ListPipelineConfig>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    sortKey: 'name',
    render: (item) => item.name,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    sortKey: 'status',
    render: (item) => item.status,
  },
  {
    key: 'created_at',
    header: 'Created',
    sortable: true,
    sortKey: 'created_at',
    render: (item) => item.created_at,
  },
]

function getDataRows(container: HTMLElement) {
  return container.querySelectorAll('.table-body .table-row')
}

function getCellTexts(container: HTMLElement, dataLabel: string) {
  return Array.from(getDataRows(container)).map(
    (row) => row.querySelector(`[data-label="${dataLabel}"]`)?.textContent?.trim() ?? '',
  )
}

describe('PipelinesTable', () => {
  it('renders data in initial order when no sort applied', () => {
    const { container } = render(
      <PipelinesTable data={mockData} columns={sortableColumns} />,
    )
    const names = getCellTexts(container, 'Name')
    expect(names).toEqual(['Alpha Pipeline', 'Beta Pipeline', 'Gamma Pipeline'])
  })

  it('sorts by name ascending on first header click', () => {
    const { container } = render(
      <PipelinesTable data={mockData} columns={sortableColumns} />,
    )
    const nameHeader = screen.getByText('Name')
    fireEvent.click(nameHeader)

    const names = getCellTexts(container, 'Name')
    expect(names).toEqual(['Alpha Pipeline', 'Beta Pipeline', 'Gamma Pipeline'])
  })

  it('sorts by name descending on second header click', () => {
    const { container } = render(
      <PipelinesTable data={mockData} columns={sortableColumns} />,
    )
    const nameHeader = screen.getByText('Name')
    fireEvent.click(nameHeader)
    fireEvent.click(nameHeader)

    const names = getCellTexts(container, 'Name')
    expect(names).toEqual(['Gamma Pipeline', 'Beta Pipeline', 'Alpha Pipeline'])
  })

  it('clears sort on third header click (back to data order)', () => {
    const { container } = render(
      <PipelinesTable data={mockData} columns={sortableColumns} />,
    )
    const nameHeader = screen.getByText('Name')
    fireEvent.click(nameHeader)
    fireEvent.click(nameHeader)
    fireEvent.click(nameHeader)

    const names = getCellTexts(container, 'Name')
    expect(names).toEqual(['Alpha Pipeline', 'Beta Pipeline', 'Gamma Pipeline'])
  })

  it('sorts by status using priority order (active before paused before stopped)', () => {
    const { container } = render(
      <PipelinesTable data={mockData} columns={sortableColumns} />,
    )
    const statusHeader = screen.getByText('Status')
    fireEvent.click(statusHeader)

    const statuses = getCellTexts(container, 'Status')
    expect(statuses).toEqual(['active', 'paused', 'stopped'])
  })

  it('shows empty message when data is empty', () => {
    render(
      <PipelinesTable data={[]} columns={sortableColumns} emptyMessage="No pipelines" />,
    )
    expect(screen.getByText('No pipelines')).toBeInTheDocument()
  })

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn()
    const { container } = render(
      <PipelinesTable data={mockData} columns={sortableColumns} onRowClick={onRowClick} />,
    )
    const rows = getDataRows(container)
    fireEvent.click(rows[1])
    expect(onRowClick).toHaveBeenCalledWith(mockData[1])
  })

  it('shows loading state when isLoading is true', () => {
    render(
      <PipelinesTable data={mockData} columns={sortableColumns} isLoading />,
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
