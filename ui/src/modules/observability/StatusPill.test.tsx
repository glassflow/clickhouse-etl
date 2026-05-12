import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { StatusPill } from './StatusPill'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StatusPill', () => {
  it('renders nothing while loading', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(<StatusPill />)
    expect(container.firstChild).toBeNull()
  })

  it('renders retention info on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        vmsingle: { version: null, retention: '7d', diskUsageBytes: 1_500_000_000, diskQuotaBytes: null },
        victoriaLogs: { version: null, retention: '3d', diskUsageBytes: 4_700_000_000, diskQuotaBytes: null },
        fanOut: { collectorEndpoint: null, external: [] },
        cardinality: [],
      }),
    })
    render(<StatusPill />)
    await waitFor(() => expect(screen.getByText(/internal stack/i)).toBeInTheDocument())
    expect(screen.getByText(/7d/)).toBeInTheDocument()
    expect(screen.getByText(/3d/)).toBeInTheDocument()
  })

  it('renders nothing when the stack route errors out', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    const { container } = render(<StatusPill />)
    await waitFor(() => expect(container.firstChild).toBeNull())
  })
})
