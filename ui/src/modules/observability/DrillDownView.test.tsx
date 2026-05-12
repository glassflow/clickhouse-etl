import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DrillDownView } from './DrillDownView'

const pinBrushedRange = vi.fn()
const clearBrushedRange = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/pipelines/abc/metrics',
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('@/src/store', () => ({
  useStore: () => ({
    observabilityStore: {
      rangeKey: '1h',
      customRange: null,
      brushedRange: null,
      autoRefreshIntervalMs: 30_000,
      setRangeKey: vi.fn(),
      setCustomRange: vi.fn(),
      pinBrushedRange,
      clearBrushedRange,
      setAutoRefreshIntervalMs: vi.fn(),
    },
  }),
}))

vi.mock('@/src/hooks/useMetricsQuery', () => ({
  useMetricsQuery: () => ({
    data: {
      promql: 'rate(...)',
      query: 'records_ingested',
      result: {
        status: 'success',
        result: [
          {
            metric: { component: 'ingestor' },
            values: [
              [1_700_000_000, '100'],
              [1_700_000_060, '110'],
              [1_700_000_120, '120'],
            ] as [number, string][],
          },
        ],
      },
    },
    error: null,
    isLoading: false,
  }),
}))

beforeEach(() => {
  pinBrushedRange.mockReset()
  clearBrushedRange.mockReset()
})
afterEach(() => cleanup())

describe('DrillDownView with OBChartSVG', () => {
  it('renders the back-to-metrics link', () => {
    render(<DrillDownView pipelineId="abc" queryKey="records_ingested" />)
    expect(screen.getByRole('link', { name: /back to metrics/i })).toBeInTheDocument()
  })

  it('renders an OBChartSVG (not a Recharts LineChart)', () => {
    const { container } = render(<DrillDownView pipelineId="abc" queryKey="records_ingested" />)
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()
    expect(container.querySelector('.recharts-wrapper')).toBeNull()
  })

  it('mouse-drag on the chart calls pinBrushedRange', () => {
    const { container } = render(<DrillDownView pipelineId="abc" queryKey="records_ingested" />)
    const svg = container.querySelector('svg[role="img"]')!
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 100 })
    fireEvent.mouseUp(svg, { clientX: 200, clientY: 100 })
    expect(pinBrushedRange).toHaveBeenCalled()
    const [range, source] = pinBrushedRange.mock.calls[0]
    expect(source).toBe('metrics_drill_down')
    expect(range.fromMs).toBeLessThan(range.toMs)
  })
})
