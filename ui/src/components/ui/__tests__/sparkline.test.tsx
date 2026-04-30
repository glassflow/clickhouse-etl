import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline } from '../sparkline'

describe('Sparkline', () => {
  it('renders an svg path with the provided data', () => {
    const { container } = render(<Sparkline data={[1, 4, 2, 7, 3, 8]} width={120} height={32} />)
    const path = container.querySelector('path')
    expect(path).toBeTruthy()
    expect(path?.getAttribute('d')?.length).toBeGreaterThan(0)
  })

  it('renders an empty path for empty data', () => {
    const { container } = render(<Sparkline data={[]} width={120} height={32} />)
    expect(container.querySelector('path')?.getAttribute('d')).toBe('')
  })

  it('handles flat-line data (all values equal) without dividing by zero', () => {
    const { container } = render(<Sparkline data={[5, 5, 5, 5]} width={100} height={20} />)
    const d = container.querySelector('path')?.getAttribute('d')
    expect(d).toBeTruthy()
    expect(d).not.toContain('NaN')
  })
})
