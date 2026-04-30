import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RetentionBar } from './RetentionBar'

describe('RetentionBar', () => {
  afterEach(() => cleanup())

  it('renders em-dash + 0% bar when usage and quota are unknown', () => {
    render(
      <RetentionBar
        label="vmsingle v1"
        retention="7d"
        diskUsageBytes={null}
        diskQuotaBytes={null}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar).toHaveStyle({ width: '0%' })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders ok tone below 50%', () => {
    render(
      <RetentionBar
        label="vmsingle v1"
        retention="7d"
        diskUsageBytes={100}
        diskQuotaBytes={1000}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain('--obs-retention-ok')
    expect(bar).toHaveStyle({ width: '10%' })
  })

  it('renders warn tone at 50–80%', () => {
    render(
      <RetentionBar
        label="vmsingle v1"
        retention="7d"
        diskUsageBytes={600}
        diskQuotaBytes={1000}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain('--obs-retention-warn')
  })

  it('renders critical tone above 80%', () => {
    render(
      <RetentionBar
        label="vmsingle v1"
        retention="7d"
        diskUsageBytes={950}
        diskQuotaBytes={1000}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain('--obs-retention-critical')
  })

  it('caps the bar at 100% even if usage exceeds quota', () => {
    render(
      <RetentionBar
        label="vmsingle v1"
        retention="7d"
        diskUsageBytes={2000}
        diskQuotaBytes={1000}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveStyle({ width: '100%' })
  })

  it('formats bytes humanely', () => {
    render(
      <RetentionBar
        label="vmsingle v1"
        retention="7d"
        diskUsageBytes={1024 * 1024 * 100}
        diskQuotaBytes={1024 * 1024 * 1024}
      />,
    )
    expect(screen.getByText(/100\.0 MB/)).toBeInTheDocument()
    expect(screen.getByText(/1\.0 GB/)).toBeInTheDocument()
  })
})
