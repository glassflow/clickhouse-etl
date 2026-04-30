import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DisabledState } from './DisabledState'
// Side-effect import: declares the runtime env shape on `window.__ENV__`.
import '@/src/api/helpers'

describe('DisabledState', () => {
  beforeEach(() => {
    window.__ENV__ = {}
  })

  afterEach(() => {
    cleanup()
    delete window.__ENV__
  })

  it('renders three ghost frames for the metrics surface', () => {
    render(<DisabledState surface="metrics" />)
    expect(screen.getByText('Records ingested')).toBeInTheDocument()
    expect(screen.getByText('p99 latency')).toBeInTheDocument()
    expect(screen.getByText('DLQ rate')).toBeInTheDocument()
  })

  it('renders three ghost frames for the logs surface', () => {
    render(<DisabledState surface="logs" />)
    expect(screen.getByText('Log volume')).toBeInTheDocument()
    expect(screen.getByText('Error rate')).toBeInTheDocument()
    expect(screen.getByText('Live tail')).toBeInTheDocument()
  })

  it('shows the helm snippet so operators know how to flip the flag', () => {
    render(<DisabledState surface="metrics" />)
    // The helm snippet contains the well-known flag key — check for that.
    expect(
      screen.getByText((content) => content.includes('internalObservability:')),
    ).toBeInTheDocument()
  })

  it('omits the external Grafana button when the env var is unset', () => {
    render(<DisabledState surface="metrics" />)
    expect(screen.queryByText('Open in your Grafana')).toBeNull()
  })

  it('shows the external Grafana button when the env var is set', () => {
    window.__ENV__ = {
      NEXT_PUBLIC_EXTERNAL_GRAFANA_URL: 'https://grafana.example.com',
    }
    render(<DisabledState surface="metrics" />)
    const link = screen.getByRole('link', { name: /Open in your Grafana/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://grafana.example.com')
  })

  it('always renders the Stack settings link', () => {
    render(<DisabledState surface="logs" />)
    const link = screen.getByRole('link', { name: /Stack settings/i })
    expect(link).toHaveAttribute('href', '/workspace/observability')
  })
})
