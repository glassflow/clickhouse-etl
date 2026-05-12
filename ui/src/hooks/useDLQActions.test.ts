import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDLQActions } from './useDLQActions'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('useDLQActions', () => {
  it('fetches state on mount', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 47, size: 12_000 }),
    })
    const { result } = renderHook(() => useDLQActions('abc'))
    await waitFor(() => expect(result.current.state).toEqual({ count: 47, size: 12_000 }))
    expect(fetchMock).toHaveBeenCalledWith('/ui-api/pipeline/abc/dlq/state')
  })

  it('consume() POSTs and refetches state', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 47 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ consumed: 100 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0 }) })
    const { result } = renderHook(() => useDLQActions('abc'))
    await waitFor(() => expect(result.current.state).toBeTruthy())
    await act(async () => {
      await result.current.consume(100)
    })
    expect(result.current.actionMessage).toMatch(/consumed/i)
    expect(result.current.state?.count).toBe(0)
  })

  it('purge() DELETEs and refetches state', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 47 }) })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0 }) })
    const { result } = renderHook(() => useDLQActions('abc'))
    await waitFor(() => expect(result.current.state).toBeTruthy())
    await act(async () => {
      await result.current.purge()
    })
    expect(result.current.state?.count).toBe(0)
  })

  it('exposes a purging loading flag', async () => {
    let resolvePurge: () => void = () => {}
    const purgeBlocker = new Promise<{ ok: boolean }>((res) => {
      resolvePurge = () => res({ ok: true })
    })
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 47 }) })
      .mockReturnValueOnce(purgeBlocker)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0 }) })
    const { result } = renderHook(() => useDLQActions('abc'))
    await waitFor(() => expect(result.current.state).toBeTruthy())
    expect(result.current.purging).toBe(false)
    act(() => {
      result.current.purge()
    })
    await waitFor(() => expect(result.current.purging).toBe(true))
    await act(async () => {
      resolvePurge()
    })
    await waitFor(() => expect(result.current.purging).toBe(false))
  })

  it('ignores stale state response after pipelineId changes', async () => {
    let resolveStaleFetch: (val: { ok: boolean; json: () => Promise<unknown> }) => void = () => {}
    const staleResponse = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((res) => {
      resolveStaleFetch = res
    })
    fetchMock.mockReturnValueOnce(staleResponse).mockResolvedValueOnce({ ok: true, json: async () => ({ count: 9 }) })

    const { result, rerender } = renderHook(({ id }) => useDLQActions(id), {
      initialProps: { id: 'old' },
    })
    rerender({ id: 'new' })
    await waitFor(() => expect(result.current.state).toEqual({ count: 9 }))

    await act(async () => {
      resolveStaleFetch({ ok: true, json: async () => ({ count: 999 }) })
    })
    expect(result.current.state).toEqual({ count: 9 })
  })
})
