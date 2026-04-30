import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TransformsList } from '../TransformsList'

const items = [
  {
    id: 't1',
    name: 'normalize',
    description: null,
    folderId: null,
    tags: [],
    language: 'js' as const,
    code: 'return e',
    inputSchemaId: null,
    outputSchemaId: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 't2',
    name: 'enrich-orders',
    description: 'add geo',
    folderId: null,
    tags: ['prod'],
    language: 'sql' as const,
    code: 'SELECT *',
    inputSchemaId: null,
    outputSchemaId: null,
    createdAt: '',
    updatedAt: '',
  },
]

describe('TransformsList', () => {
  it('renders rows with name + language pill', () => {
    render(
      <TransformsList
        transforms={items}
        searchQuery=""
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText('normalize')).toBeInTheDocument()
    expect(screen.getByText('enrich-orders')).toBeInTheDocument()
    expect(screen.getByText('js')).toBeInTheDocument()
    expect(screen.getByText('sql')).toBeInTheDocument()
  })

  it('filters by search query against name', () => {
    render(
      <TransformsList
        transforms={items}
        searchQuery="enrich"
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.queryByText('normalize')).not.toBeInTheDocument()
    expect(screen.getByText('enrich-orders')).toBeInTheDocument()
  })

  it('renders empty state when no transforms', () => {
    render(
      <TransformsList
        transforms={[]}
        searchQuery=""
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText(/No transforms saved yet/)).toBeInTheDocument()
  })
})
