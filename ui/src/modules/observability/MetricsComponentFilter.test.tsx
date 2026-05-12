import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MetricsComponentFilter, useSelectedMetricsComponents } from './MetricsComponentFilter'
import { renderHook } from '@testing-library/react'

const setUrl = vi.fn()
let urlValue: string[] = []

vi.mock('@/src/hooks/useUrlState', () => ({
  useUrlStateArray: (_key: string, _default: string[]) => [urlValue, setUrl] as const,
  useUrlState: () => ['', vi.fn()] as const,
}))

describe('MetricsComponentFilter', () => {
  beforeEach(() => {
    urlValue = []
    setUrl.mockReset()
  })
  afterEach(() => cleanup())

  it('renders three component pills', () => {
    render(<MetricsComponentFilter />)
    expect(screen.getByRole('button', { name: /ingestor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /processor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sink/i })).toBeInTheDocument()
  })

  it('toggling a pill writes to the URL', async () => {
    const user = userEvent.setup()
    render(<MetricsComponentFilter />)
    await user.click(screen.getByRole('button', { name: /ingestor/i }))
    expect(setUrl).toHaveBeenCalledWith(['ingestor'])
  })

  it('un-toggling a pill removes it from the URL', async () => {
    urlValue = ['ingestor', 'sink']
    const user = userEvent.setup()
    render(<MetricsComponentFilter />)
    await user.click(screen.getByRole('button', { name: /ingestor/i }))
    expect(setUrl).toHaveBeenCalledWith(['sink'])
  })

  it('ignores unknown URL values (sanitization)', () => {
    urlValue = ['foo', 'ingestor', 'bogus']
    const { result } = renderHook(() => useSelectedMetricsComponents())
    expect(result.current).toEqual(['ingestor'])
  })

  it('returns a stable reference for the all-components fallback', () => {
    urlValue = []
    const { result, rerender } = renderHook(() => useSelectedMetricsComponents())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
