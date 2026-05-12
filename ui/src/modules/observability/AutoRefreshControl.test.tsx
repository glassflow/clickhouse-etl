import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoRefreshControl } from './AutoRefreshControl'

const setAutoRefreshIntervalMs = vi.fn()
let currentInterval: number | null = 30_000

vi.mock('@/src/store', () => ({
  useStore: () => ({
    observabilityStore: {
      get autoRefreshIntervalMs() {
        return currentInterval
      },
      setAutoRefreshIntervalMs,
    },
  }),
}))

// Polyfill jsdom-missing pointer APIs that Radix Select requires.
// jsdom does not implement hasPointerCapture/setPointerCapture/releasePointerCapture
// or Element.prototype.scrollIntoView — Radix Select touches all of them during
// open/close. We patch the prototype so userEvent.click works against the trigger.
beforeAll(() => {
  if (typeof window === 'undefined') return
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

describe('AutoRefreshControl', () => {
  beforeEach(() => {
    currentInterval = 30_000
    setAutoRefreshIntervalMs.mockReset()
    window.localStorage.clear()
  })
  afterEach(() => cleanup())

  it('renders the current interval label', () => {
    render(<AutoRefreshControl />)
    expect(screen.getByRole('combobox')).toHaveTextContent('30s')
  })

  it('selecting "off" calls setAutoRefreshIntervalMs(null)', async () => {
    const user = userEvent.setup()
    render(<AutoRefreshControl />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /off/i }))
    expect(setAutoRefreshIntervalMs).toHaveBeenCalledWith(null)
  })

  it('selecting "15s" calls setAutoRefreshIntervalMs(15000)', async () => {
    const user = userEvent.setup()
    render(<AutoRefreshControl />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /15s/i }))
    expect(setAutoRefreshIntervalMs).toHaveBeenCalledWith(15_000)
  })

  it('persists selection to localStorage', async () => {
    const user = userEvent.setup()
    render(<AutoRefreshControl />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /60s/i }))
    expect(window.localStorage.getItem('obs.autoRefreshIntervalMs.v1')).toBe('60000')
  })

  it('restores selection from localStorage on mount', () => {
    window.localStorage.setItem('obs.autoRefreshIntervalMs.v1', '15000')
    render(<AutoRefreshControl />)
    expect(setAutoRefreshIntervalMs).toHaveBeenCalledWith(15_000)
  })
})
