import { describe, it, expect } from 'vitest'
import { determineDashboardState } from './types'
import type { DashPipeline, Incident, DashStats, ActivityItem } from './types'

const stats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 42600, eventsPerSecDelta: 8.2,
  errorRate: 0.34, errorRateDelta: 0.21,
  dlqEvents: 2847, dlqDelta: 412,
  avgLagMs: 1200, avgLagMsDelta: 0,
  throughputIn: 153400000, throughputOut: 152800000, throughputLossPct: 0.39,
  throughputSeries: { in: Array(60).fill(720), out: Array(60).fill(702) },
}
const activity: ActivityItem[] = []

const runPipeline: DashPipeline = {
  id: 'p1', name: 'orders', version: 'v12', sourceTopic: 'orders.events',
  destTable: 'analytics.orders', status: 'run', statusLabel: 'running',
  throughput: '8.4k', throughputUnit: '/s', lagP95: '1.2', lagUnit: 's',
  dlq: '0', lastDeploy: '14m ago', deployedBy: 'maria.a',
}
const failPipeline: DashPipeline = { ...runPipeline, status: 'fail', statusLabel: 'failing' }

const incident: Incident = {
  id: 'i1', severity: 'crit', pipelineName: 'orders',
  title: 'DLQ growing', description: 'desc', meta: ['47m ago'], ctaLabel: 'Fix it',
}

describe('determineDashboardState', () => {
  it('returns first-run when no pipelines', () => {
    const state = determineDashboardState([], [], stats, activity)
    expect(state.kind).toBe('first-run')
  })

  it('returns healthy when pipelines exist but no incidents', () => {
    const state = determineDashboardState([runPipeline], [], stats, activity)
    expect(state.kind).toBe('healthy')
  })

  it('returns populated for 1–5 incidents with no failing pipeline', () => {
    const state = determineDashboardState([runPipeline], [incident], stats, activity)
    expect(state.kind).toBe('populated')
  })

  it('returns incident when any pipeline has status fail', () => {
    const state = determineDashboardState([failPipeline], [incident], stats, activity)
    expect(state.kind).toBe('incident')
  })

  it('returns incident when incident count exceeds 5', () => {
    const many = Array(6).fill(incident)
    const state = determineDashboardState([runPipeline], many, stats, activity)
    expect(state.kind).toBe('incident')
  })

  it('healthy state carries pipelines, stats, and activity', () => {
    const state = determineDashboardState([runPipeline], [], stats, activity)
    if (state.kind !== 'healthy') throw new Error('wrong kind')
    expect(state.pipelines).toHaveLength(1)
    expect(state.stats.activePipelines).toBe(14)
  })

  it('populated state carries incidents', () => {
    const state = determineDashboardState([runPipeline], [incident], stats, activity)
    if (state.kind !== 'populated') throw new Error('wrong kind')
    expect(state.incidents).toHaveLength(1)
  })
})
