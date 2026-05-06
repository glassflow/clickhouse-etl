import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthyBanner } from './HealthyBanner'

describe('HealthyBanner', () => {
  it('renders the all-healthy title', () => {
    render(<HealthyBanner lastIncident="4d 12h ago" />)
    expect(screen.getByText('All pipelines healthy')).toBeInTheDocument()
  })

  it('renders the description text', () => {
    render(<HealthyBanner lastIncident="4d 12h ago" />)
    expect(screen.getByText(/No incidents in the last 24 hours/)).toBeInTheDocument()
  })

  it('displays last incident time', () => {
    render(<HealthyBanner lastIncident="4d 12h ago" />)
    expect(screen.getByText(/4d 12h ago/)).toBeInTheDocument()
  })
})
