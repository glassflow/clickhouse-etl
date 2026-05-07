import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PipelinesEmptyState } from './PipelinesEmptyState'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/src/hooks/useJourneyAnalytics', () => ({
  useJourneyAnalytics: () => ({ page: { pipelines: vi.fn() } }),
}))

describe('PipelinesEmptyState', () => {
  it('renders the empty state heading', () => {
    render(<PipelinesEmptyState />)
    expect(screen.getByText(/no pipelines yet/i)).toBeTruthy()
  })

  it('renders Create from scratch CTA', () => {
    render(<PipelinesEmptyState />)
    expect(screen.getByRole('button', { name: /create from scratch/i })).toBeTruthy()
  })

  it('renders Create with AI CTA', () => {
    render(<PipelinesEmptyState />)
    expect(screen.getByRole('button', { name: /create with ai/i })).toBeTruthy()
  })

  it('renders quick-start template cards', () => {
    render(<PipelinesEmptyState />)
    expect(screen.getByText(/dedup/i)).toBeTruthy()
    expect(screen.getByText(/filter/i)).toBeTruthy()
    expect(screen.getByText(/direct ingest/i)).toBeTruthy()
  })
})
