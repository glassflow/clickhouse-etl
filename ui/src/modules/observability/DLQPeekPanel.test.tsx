import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { DLQPeekPanel } from './DLQPeekPanel'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('DLQPeekPanel', () => {
  it('renders count badge from state endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 47 }),
    })
    render(<DLQPeekPanel pipelineId="abc" />)
    await waitFor(() => expect(screen.getByText('47')).toBeInTheDocument())
    expect(screen.getByText(/events/i)).toBeInTheDocument()
  })

  it('renders Open DLQ viewer link pointing to /dlq', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ count: 5 }) })
    render(<DLQPeekPanel pipelineId="abc" />)
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /open dlq viewer/i })).toHaveAttribute(
        'href',
        expect.stringContaining('abc'),
      ),
    )
  })

  it('shows the Open viewer link even when count is zero', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) })
    render(<DLQPeekPanel pipelineId="abc" />)
    await waitFor(() => expect(screen.getByText(/no failed events/i)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /open dlq viewer/i })).toBeInTheDocument()
  })
})
