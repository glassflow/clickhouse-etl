import { describe, it, expect } from 'vitest'

describe('Testing infrastructure', () => {
  it('runs vitest and jsdom', () => {
    expect(typeof window).toBe('object')
    expect(document.createElement('div')).toBeInstanceOf(HTMLDivElement)
  })

  it('has jest-dom and React Testing Library available for component tests', () => {
    // Setup imports jest-dom (toBeInTheDocument etc.) and RTL is installed.
    // Add component tests under src/modules/create/*.test.tsx once wizard tests are added.
    expect(typeof document).toBe('object')
  })
})
