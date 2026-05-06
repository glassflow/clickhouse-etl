import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashHeader } from './DashHeader'
import type { DashboardState } from '../types'

const noop = vi.fn()
const baseProps = { env: 'production', range: 'last 1h', onEnvChange: noop, onRangeChange: noop }

describe('DashHeader', () => {
  it('shows "Welcome to GlassFlow" in first-run state', () => {
    const state: DashboardState = { kind: 'first-run' }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to GlassFlow')
  })

  it('shows "Dashboard" in healthy state', () => {
    const state: DashboardState = {
      kind: 'healthy', pipelines: [], stats: {} as any, activity: [],
    }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
  })

  it('shows "Several pipelines need attention" in incident state', () => {
    const state: DashboardState = {
      kind: 'incident', pipelines: [], stats: {} as any, incidents: [], activity: [],
    }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Several pipelines need attention')
  })

  it('shows env and range pills in non-first-run state', () => {
    const state: DashboardState = { kind: 'healthy', pipelines: [], stats: {} as any, activity: [] }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByText('production')).toBeInTheDocument()
    expect(screen.getByText('last 1h')).toBeInTheDocument()
  })

  it('shows Docs and Demo pills in first-run state instead of env/range', () => {
    const state: DashboardState = { kind: 'first-run' }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText(/Watch demo/)).toBeInTheDocument()
    expect(screen.queryByText('production')).not.toBeInTheDocument()
  })

  it('healthy subtitle mentions "running smoothly"', () => {
    const state: DashboardState = {
      kind: 'healthy', pipelines: [{ id: 'p1' } as any], stats: {} as any, activity: [],
    }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByText(/running smoothly/)).toBeInTheDocument()
  })
})
