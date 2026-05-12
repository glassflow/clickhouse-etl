import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import * as React from 'react'
import { ChartCard } from './ChartCard'

vi.mock('@/src/store', () => ({
  useStore: () => ({
    observabilityStore: {
      pinBrushedRange: vi.fn(),
    },
  }),
}))

// Recharts' ResponsiveContainer relies on layout dimensions, which jsdom
// reports as 0x0 — it then refuses to render the chart. Replace it with a
// fixed-size wrapper so the underlying SVG (and the .recharts-line nodes we
// assert against) actually mount.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) =>
      React.cloneElement(children, { width: 400, height: 180 }),
  }
})

const mockData = {
  promql: 'rate(...)',
  query: 'records_ingested',
  result: {
    status: 'success',
    result: [
      {
        metric: { component: 'ingestor' },
        values: [
          [1, '100'],
          [2, '110'],
        ] as [number, string][],
      },
      {
        metric: { component: 'processor' },
        values: [
          [1, '80'],
          [2, '90'],
        ] as [number, string][],
      },
      {
        metric: { component: 'sink' },
        values: [
          [1, '70'],
          [2, '75'],
        ] as [number, string][],
      },
    ],
  },
}

afterEach(() => cleanup())

describe('ChartCard multi-series', () => {
  it('renders one <Line /> per component in the response', () => {
    const { container } = render(
      <ChartCard title="Records ingested" query="rate(...)" data={mockData as any} loading={false} />,
    )
    const lines = container.querySelectorAll('.recharts-line')
    expect(lines.length).toBe(3)
  })

  it('filters series when selectedComponents prop is set', () => {
    const { container } = render(
      <ChartCard
        title="Records ingested"
        query="rate(...)"
        data={mockData as any}
        loading={false}
        selectedComponents={['ingestor']}
      />,
    )
    const lines = container.querySelectorAll('.recharts-line')
    expect(lines.length).toBe(1)
  })

  it('falls back to a single series when no component label is present', () => {
    const { container } = render(
      <ChartCard
        title="x"
        query="x"
        loading={false}
        data={
          {
            promql: 'x',
            query: 'x',
            result: {
              status: 'success',
              result: [{ metric: {}, values: [[1, '5'] as [number, string]] }],
            },
          } as any
        }
      />,
    )
    expect(container.querySelectorAll('.recharts-line').length).toBe(1)
  })
})
