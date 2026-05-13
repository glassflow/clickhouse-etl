import { act, renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useFleetSparkline } from './useFleetSparkline'

const MOCK_RESULT = {
  result: {
    resultType: 'matrix',
    result: [
      {
        metric: {},
        values: [
          [1700000000, '100'],
          [1700000060, '120'],
          [1700000120, '110'],
        ],
      },
    ],
  },
}

describe('useFleetSparkline', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches and returns numeric series values', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RESULT,
    } as Response)

    const { result } = renderHook(() =>
      useFleetSparkline('pipe-1', 'records_ingested', 1700000000000, 1700003600000, '15s', null),
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.values).toEqual([100, 120, 110])
    expect(result.current.latest).toBe(110)
    expect(result.current.error).toBeUndefined()
  })

  it('does not fetch when pipelineId is empty', async () => {
    const { result } = renderHook(() =>
      useFleetSparkline('', 'records_ingested', 1700000000000, 1700003600000, '15s', null),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.values).toEqual([])
  })

  it('sets error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal error' }),
    } as Response)

    const { result } = renderHook(() =>
      useFleetSparkline('pipe-1', 'records_ingested', 1700000000000, 1700003600000, '15s', null),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.message).toBe('internal error')
    expect(result.current.values).toEqual([])
  })

  it('falls back to HTTP status message when error body has no message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)

    const { result } = renderHook(() =>
      useFleetSparkline('pipe-1', 'records_ingested', 1700000000000, 1700003600000, '15s', null),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.message).toBe('HTTP 503')
  })

  it('re-fetches on auto-refresh interval and clears interval on unmount', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => MOCK_RESULT,
    } as Response)

    const { unmount } = renderHook(() =>
      useFleetSparkline('pipe-1', 'records_ingested', 1700000000000, 1700003600000, '15s', 30000),
    )

    // Let the initial fetch complete (no timers needed, just flush microtasks)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)

    // Advance past the refresh interval — the setInterval fires, tick increments,
    // the effect re-runs, and fetch is called again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)

    unmount()

    // Advancing after unmount must not trigger another fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })
})
