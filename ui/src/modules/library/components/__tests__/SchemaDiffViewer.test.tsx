import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SchemaDiffViewer, computeFieldDiff } from '../SchemaDiffViewer'

const oldFields = [
  { name: 'id', type: 'string', nullable: false },
  { name: 'amount', type: 'int', nullable: false },
  { name: 'note', type: 'string', nullable: true },
]
const newFields = [
  { name: 'id', type: 'string', nullable: false }, // unchanged
  { name: 'amount', type: 'decimal', nullable: false }, // changed type
  { name: 'currency', type: 'string', nullable: false }, // added
  // note removed
]

describe('computeFieldDiff', () => {
  it('classifies unchanged, changed, added, removed fields', () => {
    const diff = computeFieldDiff(oldFields, newFields)
    expect(diff.find((d) => d.name === 'id')?.kind).toBe('unchanged')
    expect(diff.find((d) => d.name === 'amount')?.kind).toBe('changed')
    expect(diff.find((d) => d.name === 'currency')?.kind).toBe('added')
    expect(diff.find((d) => d.name === 'note')?.kind).toBe('removed')
  })

  it('detects nullability change as "changed"', () => {
    const a = [{ name: 'x', type: 'string', nullable: false }]
    const b = [{ name: 'x', type: 'string', nullable: true }]
    expect(computeFieldDiff(a, b)[0].kind).toBe('changed')
  })
})

describe('SchemaDiffViewer', () => {
  it('renders all field names from union of versions', () => {
    render(
      <SchemaDiffViewer
        oldVersion={{ version: '1.0.0', fields: oldFields }}
        newVersion={{ version: '1.1.0', fields: newFields }}
      />,
    )
    expect(screen.getAllByText('id').length).toBeGreaterThan(0)
    expect(screen.getAllByText('amount').length).toBeGreaterThan(0)
    expect(screen.getAllByText('currency').length).toBeGreaterThan(0)
    expect(screen.getAllByText('note').length).toBeGreaterThan(0)
  })

  it('marks added/removed/changed counts in the header', () => {
    render(
      <SchemaDiffViewer
        oldVersion={{ version: '1.0.0', fields: oldFields }}
        newVersion={{ version: '1.1.0', fields: newFields }}
      />,
    )
    expect(screen.getByText(/\+1 added/)).toBeInTheDocument()
    expect(screen.getByText(/−1 removed/)).toBeInTheDocument()
    expect(screen.getByText(/~1 changed/)).toBeInTheDocument()
  })
})
