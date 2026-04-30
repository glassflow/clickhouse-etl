import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton, SkeletonRow } from '../skeleton'

describe('Skeleton', () => {
  it('renders a shimmer block with custom dimensions', () => {
    const { container } = render(<Skeleton width={120} height={20} />)
    const block = container.firstChild as HTMLElement
    expect(block).toBeTruthy()
    expect(block.style.width).toBe('120px')
    expect(block.style.height).toBe('20px')
  })

  it('SkeletonRow renders n placeholders', () => {
    const { container } = render(<SkeletonRow count={5} />)
    expect(container.querySelectorAll('[data-skeleton]').length).toBe(5)
  })
})
