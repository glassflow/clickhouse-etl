import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CardinalityTable } from './CardinalityTable'

describe('CardinalityTable', () => {
  afterEach(() => cleanup())

  it('renders an empty-state line when there are no probes', () => {
    render(<CardinalityTable probes={[]} />)
    expect(screen.getByText(/No cardinality probes returned/)).toBeInTheDocument()
  })

  it('renders each probe as a row', () => {
    render(
      <CardinalityTable
        probes={[
          { label: 'series total', value: 1234 },
          { label: 'distinct pipeline_ids', value: 7 },
        ]}
      />,
    )
    expect(screen.getByText('series total')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('distinct pipeline_ids')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('shows em-dash for null values so unreachable upstreams render', () => {
    render(<CardinalityTable probes={[{ label: 'series total', value: null }]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
