import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashFirstRun } from './DashFirstRun'

describe('DashFirstRun', () => {
  it('renders the main heading', () => {
    render(<DashFirstRun />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent("Set up your first pipeline")
  })

  it('renders all 6 action tiles by name', () => {
    render(<DashFirstRun />)
    expect(screen.getByText('Guided wizard')).toBeInTheDocument()
    expect(screen.getByText('From template')).toBeInTheDocument()
    expect(screen.getByText('Visual canvas')).toBeInTheDocument()
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Import config')).toBeInTheDocument()
    expect(screen.getByText('Try with sample data')).toBeInTheDocument()
  })

  it('marks "From template" and "Try with sample data" as disabled', () => {
    const { container } = render(<DashFirstRun />)
    const disabled = container.querySelectorAll('.empty-path.disabled')
    expect(disabled).toHaveLength(2)
    const names = Array.from(disabled).map((el) => el.querySelector('.empty-path-name')?.textContent)
    expect(names).toContain('From template')
    expect(names).toContain('Try with sample data')
  })

  it('active tiles are not marked disabled', () => {
    const { container } = render(<DashFirstRun />)
    const active = [
      ...container.querySelectorAll('.empty-primary-path'),
      ...container.querySelectorAll('.empty-path:not(.disabled)'),
    ]
    expect(active).toHaveLength(4)
  })

  it('Guided wizard tile links to /home', () => {
    render(<DashFirstRun />)
    const link = screen.getByRole('link', { name: /Guided wizard/ })
    expect(link).toHaveAttribute('href', '/home')
  })

  it('Ask AI tile links to /pipelines/create/ai', () => {
    render(<DashFirstRun />)
    const link = screen.getByRole('link', { name: /Ask AI/ })
    expect(link).toHaveAttribute('href', '/pipelines/create/ai')
  })
})
