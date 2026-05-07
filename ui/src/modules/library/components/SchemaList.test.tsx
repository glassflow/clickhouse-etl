import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SchemaList } from './SchemaList'
import type { LibrarySchema } from '@/src/hooks/useLibraryConnections'

const base: LibrarySchema = {
  id: 's1', name: 'events', description: null,
  folderId: null, tags: [], source: 'kafka', registryUrl: null,
  fields: [], fieldCount: 3, pipelineCount: 2,
  latestVersion: 'v2', hasDrift: false, usedByCount: 2,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
}
const drifted: LibrarySchema = { ...base, id: 's2', name: 'metrics', source: 'otlp', hasDrift: true, latestVersion: 'v1' }
const manual: LibrarySchema = { ...base, id: 's3', name: 'manual_cfg', source: 'manual' }

describe('SchemaList', () => {
  it('renders source filter chips', () => {
    render(<SchemaList schemas={[base]} />)
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kafka/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /OTLP/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manual/i })).toBeInTheDocument()
  })

  it('shows version badge on each card', () => {
    render(<SchemaList schemas={[base]} />)
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('shows drift indicator on drifted schema card', () => {
    const { container } = render(<SchemaList schemas={[drifted]} />)
    expect(container.querySelector('.schema-card-drift')).not.toBeNull()
  })

  it('filters schemas by source chip click', async () => {
    render(<SchemaList schemas={[base, drifted, manual]} />)
    await userEvent.click(screen.getByRole('button', { name: /OTLP/i }))
    expect(screen.getByText('metrics')).toBeInTheDocument()
    expect(screen.queryByText('events')).not.toBeInTheDocument()
    expect(screen.queryByText('manual_cfg')).not.toBeInTheDocument()
  })

  it('shows all schemas when All chip is active', async () => {
    render(<SchemaList schemas={[base, drifted, manual]} />)
    await userEvent.click(screen.getByRole('button', { name: /OTLP/i }))
    await userEvent.click(screen.getByRole('button', { name: /All/i }))
    expect(screen.getByText('events')).toBeInTheDocument()
    expect(screen.getByText('metrics')).toBeInTheDocument()
    expect(screen.getByText('manual_cfg')).toBeInTheDocument()
  })
})
