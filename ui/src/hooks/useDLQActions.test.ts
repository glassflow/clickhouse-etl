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
})
