import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { OBChartSVG } from './OBChartSVG'

const series = [
  {
    id: 'ingestor',
    color: 'var(--obs-chart-ingestor)',
    points: [
      [1_700_000_000_000, 100],
      [1_700_000_060_000, 110],
      [1_700_000_120_000, 105],
    ] as Array<[number, number]>,
  },
]

afterEach(() => cleanup())

describe('OBChartSVG base rendering', () => {
  it('renders one <path> per series', () => {
    const { container } = render(<OBChartSVG series={series} width={400} height={200} />)
    const paths = container.querySelectorAll('path[data-series-id]')
    expect(paths.length).toBe(1)
    expect(paths[0].getAttribute('data-series-id')).toBe('ingestor')
  })

  it('renders y-axis labels', () => {
    const { container } = render(<OBChartSVG series={series} width={400} height={200} />)
    const labels = container.querySelectorAll('text[data-axis="y"]')
    expect(labels.length).toBeGreaterThanOrEqual(3)
  })

  it('shows crosshair on mouse move when showCrosshair=true', () => {
    const { container } = render(<OBChartSVG series={series} width={400} height={200} showCrosshair />)
    const svg = container.querySelector('svg')!
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 })
    const crosshair = container.querySelector('[data-crosshair]')
    expect(crosshair).not.toBeNull()
  })

  it('does not render crosshair when showCrosshair is unset', () => {
    const { container } = render(<OBChartSVG series={series} width={400} height={200} />)
    const svg = container.querySelector('svg')!
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 })
    expect(container.querySelector('[data-crosshair]')).toBeNull()
  })
})
