import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FanOutDiagram } from './FanOutDiagram'

describe('FanOutDiagram', () => {
  afterEach(() => cleanup())

  it('shows "disabled" + muted internal box when internalEnabled is false', () => {
    render(
      <FanOutDiagram
        collectorEndpoint="otel:4317"
        external={[]}
        internalEnabled={false}
      />,
    )
    expect(screen.getByText('Internal stack')).toBeInTheDocument()
    expect(screen.getByText('disabled')).toBeInTheDocument()
  })

  it('shows VM + VL when internalEnabled is true', () => {
    render(
      <FanOutDiagram
        collectorEndpoint="otel:4317"
        external={[]}
        internalEnabled={true}
      />,
    )
    expect(screen.getByText('VM + VL')).toBeInTheDocument()
  })

  it('falls back to "not configured" when collectorEndpoint is null', () => {
    render(
      <FanOutDiagram collectorEndpoint={null} external={[]} internalEnabled={false} />,
    )
    expect(screen.getByText('not configured')).toBeInTheDocument()
  })

  it('falls back to "none configured" when no external targets', () => {
    render(
      <FanOutDiagram
        collectorEndpoint="otel:4317"
        external={[]}
        internalEnabled={false}
      />,
    )
    expect(screen.getByText('none configured')).toBeInTheDocument()
  })

  it('renders one box per external target', () => {
    render(
      <FanOutDiagram
        collectorEndpoint="otel:4317"
        external={[
          { name: 'datadog', url: 'https://api.datadoghq.com' },
          { name: 'newrelic', url: 'https://otlp.nr-data.net' },
        ]}
        internalEnabled={true}
      />,
    )
    expect(screen.getByText('datadog')).toBeInTheDocument()
    expect(screen.getByText('https://api.datadoghq.com')).toBeInTheDocument()
    expect(screen.getByText('newrelic')).toBeInTheDocument()
  })
})
