import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SchemaVersionTimeline } from '../SchemaVersionTimeline'
import type { SchemaVersion } from '@/src/hooks/useLibraryDetail'

const versions: SchemaVersion[] = [
  {
    id: '3',
    schemaId: 's',
    version: '1.2.0',
    fields: [],
    changeSummary: 'add currency',
    createdAt: '2026-04-29T10:00:00Z',
    createdBy: 'alice',
  },
  {
    id: '2',
    schemaId: 's',
    version: '1.1.0',
    fields: [],
    changeSummary: 'minor',
    createdAt: '2026-04-20T10:00:00Z',
    createdBy: 'bob',
  },
  {
    id: '1',
    schemaId: 's',
    version: '1.0.0',
    fields: [],
    changeSummary: 'initial',
    createdAt: '2026-04-01T10:00:00Z',
    createdBy: 'alice',
  },
]

describe('SchemaVersionTimeline', () => {
  it('renders every version label and change summary', () => {
    render(
      <SchemaVersionTimeline
        versions={versions}
        selectedA={null}
        selectedB={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('1.2.0')).toBeInTheDocument()
    expect(screen.getByText('1.1.0')).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
    expect(screen.getByText('add currency')).toBeInTheDocument()
  })

  it('calls onSelect("a", id) on first click', () => {
    const onSelect = vi.fn()
    render(
      <SchemaVersionTimeline
        versions={versions}
        selectedA={null}
        selectedB={null}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Select 1.2.0/ }))
    expect(onSelect).toHaveBeenCalledWith('a', '3')
  })

  it('marks selected versions with aria-pressed', () => {
    render(
      <SchemaVersionTimeline
        versions={versions}
        selectedA="3"
        selectedB="1"
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /Select 1.2.0/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Select 1.0.0/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Select 1.1.0/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
