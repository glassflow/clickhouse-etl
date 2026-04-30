import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useObservabilityStack } from './useObservabilityStack'

const SAMPLE = {
  vmsingle: {
    version: '1.96.0',
    retention: '7d',
    diskUsageBytes: 1024 * 1024 * 100,
    diskQuotaBytes: 1024 * 1024 * 1024,
  },
  victoriaLogs: {
    version: '0.32.0',
    retention: '3d',
    diskUsageBytes: 1024 * 1024 * 50,
    diskQuotaBytes: 1024 * 1024 * 512,
  },
  fanOut: {
    collectorEndpoint: 'otel-collector:4317',
    external: [{ name: 'datadog', url: 'https://api.datadoghq.com' }],
  },
  cardinality: [
    { label: 'series total', value: 1234 },
    { label: 'distinct pipeline_ids', value: 7 },
  ],
}

describe('useObservabilityStack', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and exposes the stack payload', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useObservabilityStack())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(SAMPLE)
    expect(result.current.error).toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledWith('/ui-api/observability/stack')
  })

  it('exposes error message on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('boom', { status: 500 }),
    )

    const { result } = renderHook(() => useObservabilityStack())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('HTTP 500')
    expect(result.current.data).toBeNull()
  })
})
