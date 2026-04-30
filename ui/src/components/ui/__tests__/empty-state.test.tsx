import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '../empty-state'

describe('EmptyState', () => {
  it('renders heading and copy', () => {
    render(<EmptyState heading="No connections" copy="Add a Kafka or ClickHouse connection to get started." />)
    expect(screen.getByText('No connections')).toBeInTheDocument()
    expect(screen.getByText(/Add a Kafka/)).toBeInTheDocument()
  })

  it('renders cta when provided', () => {
    render(
      <EmptyState
        heading="No schemas"
        copy="Publish a schema to reuse it across pipelines."
        cta={{ label: 'New schema', onClick: () => {} }}
      />,
    )
    expect(screen.getByRole('button', { name: 'New schema' })).toBeInTheDocument()
  })

  it('renders code snippet when provided', () => {
    render(
      <EmptyState
        heading="Disabled"
        copy="Enable internal observability via helm."
        codeSnippet="--set internalObservability.enabled=true"
      />,
    )
    expect(screen.getByText(/internalObservability/)).toBeInTheDocument()
  })
})
