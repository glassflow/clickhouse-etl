import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { createStore } from 'zustand/vanilla'
import { createObservabilitySlice, type ObservabilitySlice } from '@/src/store/observability.store'
import { DrillDownView } from '../DrillDownView'

// Real (test) store so brush state actually flows.
let storeApi = createStore<ObservabilitySlice>()((set, get, api) => createObservabilitySlice(set, get, api))

vi.mock('@/src/store', () => ({
  useStore: () => storeApi.getState(),
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

vi.mock('@/src/hooks/useLogsQuery', () => ({
  useLogsQuery: () => ({ data: { lines: [] }, error: null, isLoading: false }),
}))

// MetricsToolbar (rendered inside DrillDownView) transitively uses Next.js router hooks.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

beforeEach(() => {
  storeApi = createStore<ObservabilitySlice>()((set, get, api) => createObservabilitySlice(set, get, api))
})
afterEach(() => cleanup())

describe('observability smoke flow', () => {
  it('brushing the drill-down chart pins a range in the store', async () => {
    const { container } = render(<DrillDownView pipelineId="abc" queryKey="records_ingested" />)
    const svg = container.querySelector('svg[role="img"]')!
    expect(storeApi.getState().observabilityStore.brushedRange).toBeNull()
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(svg, { clientX: 300, clientY: 100 })
    fireEvent.mouseUp(svg, { clientX: 300, clientY: 100 })
    await waitFor(() => expect(storeApi.getState().observabilityStore.brushedRange).not.toBeNull())
    expect(storeApi.getState().observabilityStore.brushedRange?.source).toBe('metrics_drill_down')
  })
})
