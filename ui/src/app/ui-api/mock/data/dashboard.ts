import type { DashStats, Incident, ActivityItem, DashPipeline } from '@/src/modules/dashboard/types'

// ── stats ─────────────────────────────────────────────────────────────────

const SERIES_N = 60

function sinSeries(base: number, amp: number, freq: number): number[] {
  return Array.from({ length: SERIES_N }, (_, i) => base + Math.sin(i / freq) * amp)
}

const populatedStats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 42600, eventsPerSecDelta: 8.2,
  errorRate: 0.34, errorRateDelta: 0.21,
  dlqEvents: 2847, dlqDelta: 412,
  avgLagMs: 1200, avgLagMsDelta: 0,
  throughputIn: 153400000, throughputOut: 152800000, throughputLossPct: 0.39,
  throughputSeries: {
    in: sinSeries(720, 120, 4).map((v, i) => v + Math.cos(i / 9) * 80 + i * 2),
    out: sinSeries(702, 100, 4).map((v, i) => v + Math.cos(i / 9) * 80 + i * 2),
  },
}

const healthyStats: DashStats = {
  activePipelines: 14, totalPipelines: 14,
  eventsPerSec: 38100, eventsPerSecDelta: 2.1,
  errorRate: 0.02, errorRateDelta: 0,
  dlqEvents: 8, dlqDelta: 0,
  avgLagMs: 340, avgLagMsDelta: 0,
  throughputIn: 137160000, throughputOut: 136900000, throughputLossPct: 0.19,
  throughputSeries: {
    in: sinSeries(640, 40, 6),
    out: sinSeries(625, 40, 6),
  },
}

const incidentStats: DashStats = {
  activePipelines: 11, totalPipelines: 14,
  eventsPerSec: 28400, eventsPerSecDelta: -33,
  errorRate: 3.81, errorRateDelta: 3.59,
  dlqEvents: 14029, dlqDelta: 8200,
  avgLagMs: 8400, avgLagMsDelta: 7200,
  throughputIn: 102200000, throughputOut: 88200000, throughputLossPct: 13.7,
  throughputSeries: {
    in: Array.from({ length: SERIES_N }, (_, i) => 720 - i * 8),
    out: Array.from({ length: SERIES_N }, (_, i) => 720 - i * 10),
  },
}

// ── incidents ─────────────────────────────────────────────────────────────

const populatedIncidents: Incident[] = [
  {
    id: 'i1', severity: 'crit', pipelineName: 'orders-to-clickhouse',
    title: 'DLQ growing — schema mismatch on user_id',
    description: '412 events failed in the last hour. Source emits String, target expects UInt64. Suggested: cast in transform, or update ClickHouse column.',
    meta: ['started 47m ago', '412 events', 'v12 · revision 2025-05-04'],
    ctaLabel: 'Fix it',
  },
  {
    id: 'i2', severity: 'warn', pipelineName: 'events-stream-prod',
    title: 'Schema orders.v4 drift detected',
    description: 'Source has added 2 new fields (currency, region). Pipeline pinned to v3 — silently dropped today: 12,440 events.',
    meta: ['detected 2h ago', 'affects 3 pipelines', '2 new fields'],
    ctaLabel: 'Review drift',
  },
  {
    id: 'i3', severity: 'info', pipelineName: 'analytics-otlp-logs',
    title: 'Deploy v8 stuck in validating',
    description: 'ClickHouse insert validation hasn\'t completed in 4 minutes. Pipeline still running on v7. Safe to retry or roll back.',
    meta: ['started 4m ago', 'deployed by daniel.k', 'autorollback in 6m'],
    ctaLabel: 'Inspect',
  },
]

const incidentIncidents: Incident[] = [
  {
    id: 'i1', severity: 'crit', pipelineName: 'stripe-payments-cdc',
    title: 'ClickHouse insert failures — connection refused',
    description: 'Sink connection to analytics-prod.eu-central-1 dropping every 30s. 8,420 events queued. ClickHouse cluster shows replica lag > 60s.',
    meta: ['started 18m ago', '8,420 events', '5 retries'],
    ctaLabel: 'Inspect',
  },
  {
    id: 'i2', severity: 'crit', pipelineName: 'orders-to-clickhouse',
    title: 'DLQ growing — type mismatch on user_id',
    description: '5,609 events failed. Source emits String, target expects UInt64.',
    meta: ['started 47m ago', '5,609 events'],
    ctaLabel: 'Fix it',
  },
  {
    id: 'i3', severity: 'warn', pipelineName: 'events-stream-prod',
    title: 'Schema drift · 3 affected pipelines',
    description: 'Source added currency, region. Silently dropped today: 12,440 events.',
    meta: ['detected 2h ago'],
    ctaLabel: 'Review',
  },
  {
    id: 'i4', severity: 'warn', pipelineName: 'user-events-otlp',
    title: 'Lag exceeded threshold (5s)',
    description: 'P95 lag is 8.4s, sustained for 12m.',
    meta: ['started 12m ago'],
    ctaLabel: 'Open metrics',
  },
  {
    id: 'i5', severity: 'warn', pipelineName: 'user-events-otlp',
    title: 'Memory pressure — consumer group lagging',
    description: 'Consumer lag for group analytics-consumer is growing at 200 events/s.',
    meta: ['started 8m ago'],
    ctaLabel: 'View metrics',
  },
  {
    id: 'i6', severity: 'info', pipelineName: 'analytics-otlp-logs',
    title: 'Deploy v8 still validating',
    description: 'Validation pending 4m. Pipeline still on v7. Safe to retry or roll back.',
    meta: ['started 4m ago'],
    ctaLabel: 'Inspect',
  },
]

// ── activity ──────────────────────────────────────────────────────────────

const populatedActivity: ActivityItem[] = [
  { kind: 'deploy', text: 'deployed orders-to-clickhouse v12', actor: 'maria.a', pipelineName: 'orders-to-clickhouse', relativeTime: '14m ago' },
  { kind: 'info',   text: 'Schema orders.v4 published — 3 pipelines flagged for drift', relativeTime: '2h ago' },
  { kind: 'fail',   text: 'deploy v8 entered validating state', pipelineName: 'analytics-otlp-logs', relativeTime: '4m ago' },
  { kind: 'deploy', text: 'rolled back stripe-payments-cdc to v6', actor: 'daniel.k', pipelineName: 'stripe-payments-cdc', relativeTime: '3h ago' },
  { kind: 'pause',  text: 'paused test-events-staging', actor: 'vanessa.c', pipelineName: 'test-events-staging', relativeTime: '5h ago' },
]

const incidentActivity: ActivityItem[] = [
  { kind: 'fail',  text: 'insert failed', pipelineName: 'stripe-payments-cdc', relativeTime: '2m' },
  { kind: 'fail',  text: 'DLQ +412', pipelineName: 'orders-to-clickhouse', relativeTime: '14m' },
  { kind: 'pause', text: 'paused test-events-staging', actor: 'auto', pipelineName: 'test-events-staging', relativeTime: '22m' },
  { kind: 'info',  text: 'Schema orders.v4 drift detected', relativeTime: '2h' },
]

// ── pipelines ─────────────────────────────────────────────────────────────

const populatedPipelines: DashPipeline[] = [
  { id: 'p1', name: 'orders-to-clickhouse',  version: 'v12', sourceTopic: 'orders.events',  destTable: 'analytics.orders',  status: 'deg',    statusLabel: 'degraded',                  throughput: '8.4k',  throughputUnit: '/s', lagP95: '1.2', lagUnit: 's',   dlq: '412',  dlqSeverity: 'crit', lastDeploy: '14m ago', deployedBy: 'maria.a' },
  { id: 'p2', name: 'stripe-payments-cdc',   version: 'v6',  sourceTopic: 'stripe.cdc',      destTable: 'fin.payments',      status: 'run',    statusLabel: 'running',                   throughput: '2.1k',  throughputUnit: '/s', lagP95: '420', lagUnit: 'ms',  dlq: '0',    lastDeploy: '3h ago',  deployedBy: 'daniel.k' },
  { id: 'p3', name: 'user-events-otlp',      version: 'v9',  sourceTopic: 'otlp.events',     destTable: 'analytics.users',   status: 'run',    statusLabel: 'running',                   throughput: '18.4k', throughputUnit: '/s', lagP95: '860', lagUnit: 'ms',  dlq: '12',   lastDeploy: '2d ago',  deployedBy: 'maria.a' },
  { id: 'p4', name: 'analytics-otlp-logs',   version: 'v7',  sourceTopic: 'otlp.logs',       destTable: 'analytics.logs',    status: 'run',    statusLabel: 'running · v8 validating',   throughput: '9.8k',  throughputUnit: '/s', lagP95: '1.4', lagUnit: 's',   dlq: '8',    lastDeploy: '4m ago',  deployedBy: 'daniel.k' },
  { id: 'p5', name: 'events-stream-prod',    version: 'v4',  sourceTopic: 'events.prod',     destTable: 'analytics.events',  status: 'run',    statusLabel: 'running',                   throughput: '4.0k',  throughputUnit: '/s', lagP95: '520', lagUnit: 'ms',  dlq: '0',    lastDeploy: '1w ago',  deployedBy: 'vanessa.c' },
  { id: 'p6', name: 'test-events-staging',   version: 'v2',  sourceTopic: 'events.test',     destTable: 'staging.events',    status: 'paused', statusLabel: 'paused',                    throughput: '—',     throughputUnit: '',   lagP95: '—',   lagUnit: '',    dlq: '—',    lastDeploy: '5h ago',  deployedBy: 'vanessa.c' },
]

const healthyPipelines: DashPipeline[] = [
  { id: 'p1', name: 'orders-to-clickhouse',  version: 'v12', sourceTopic: 'orders.events',  destTable: 'analytics.orders', status: 'run', statusLabel: 'running', throughput: '8.2k',  throughputUnit: '/s', lagP95: '420', lagUnit: 'ms', dlq: '2',  lastDeploy: '2d ago', deployedBy: 'maria.a' },
  { id: 'p2', name: 'stripe-payments-cdc',   version: 'v6',  sourceTopic: 'stripe.cdc',     destTable: 'fin.payments',     status: 'run', statusLabel: 'running', throughput: '2.1k',  throughputUnit: '/s', lagP95: '380', lagUnit: 'ms', dlq: '0',  lastDeploy: '3d ago', deployedBy: 'daniel.k' },
  { id: 'p3', name: 'user-events-otlp',      version: 'v9',  sourceTopic: 'otlp.events',    destTable: 'analytics.users',  status: 'run', statusLabel: 'running', throughput: '18.4k', throughputUnit: '/s', lagP95: '420', lagUnit: 'ms', dlq: '4',  lastDeploy: '1w ago', deployedBy: 'maria.a' },
  { id: 'p4', name: 'analytics-otlp-logs',   version: 'v7',  sourceTopic: 'otlp.logs',      destTable: 'analytics.logs',   status: 'run', statusLabel: 'running', throughput: '9.4k',  throughputUnit: '/s', lagP95: '340', lagUnit: 'ms', dlq: '2',  lastDeploy: '2w ago', deployedBy: 'daniel.k' },
  { id: 'p5', name: 'events-stream-prod',    version: 'v4',  sourceTopic: 'events.prod',    destTable: 'analytics.events', status: 'run', statusLabel: 'running', throughput: '4.0k',  throughputUnit: '/s', lagP95: '400', lagUnit: 'ms', dlq: '0',  lastDeploy: '1w ago', deployedBy: 'vanessa.c' },
]

const incidentPipelines: DashPipeline[] = [
  { id: 'p1', name: 'stripe-payments-cdc',   version: 'v6',  sourceTopic: 'stripe.cdc',     destTable: 'fin.payments',      status: 'fail',   statusLabel: 'failing',                  throughput: '320',   throughputUnit: '/s', lagP95: '12.4', lagUnit: 's', lagSeverity: 'crit', dlq: '8,420', dlqSeverity: 'crit', lastDeploy: '3h ago',  deployedBy: 'daniel.k' },
  { id: 'p2', name: 'orders-to-clickhouse',  version: 'v12', sourceTopic: 'orders.events',  destTable: 'analytics.orders',  status: 'deg',    statusLabel: 'degraded',                 throughput: '4.1k',  throughputUnit: '/s', lagP95: '2.4',  lagUnit: 's', lagSeverity: 'warn', dlq: '5,609', dlqSeverity: 'crit', lastDeploy: '14m ago', deployedBy: 'maria.a' },
  { id: 'p3', name: 'user-events-otlp',      version: 'v9',  sourceTopic: 'otlp.events',    destTable: 'analytics.users',   status: 'deg',    statusLabel: 'degraded · lag',           throughput: '14.2k', throughputUnit: '/s', lagP95: '8.4',  lagUnit: 's', lagSeverity: 'warn', dlq: '12',   lastDeploy: '2d ago',  deployedBy: 'maria.a' },
  { id: 'p4', name: 'analytics-otlp-logs',   version: 'v7',  sourceTopic: 'otlp.logs',      destTable: 'analytics.logs',    status: 'run',    statusLabel: 'running · v8 validating',  throughput: '9.8k',  throughputUnit: '/s', lagP95: '1.4',  lagUnit: 's', dlq: '8',    lastDeploy: '4m ago',  deployedBy: 'daniel.k' },
  { id: 'p5', name: 'events-stream-prod',    version: 'v4',  sourceTopic: 'events.prod',    destTable: 'analytics.events',  status: 'run',    statusLabel: 'running',                  throughput: '4.0k',  throughputUnit: '/s', lagP95: '520',  lagUnit: 'ms', dlq: '0',   lastDeploy: '1w ago',  deployedBy: 'vanessa.c' },
]

// ── exported lookup ───────────────────────────────────────────────────────

type Scenario = 'populated' | 'healthy' | 'incident'

type ScenarioData = {
  stats: DashStats
  incidents: Incident[]
  activity: ActivityItem[]
  pipelines: DashPipeline[]
}

const scenarios: Record<Scenario, ScenarioData> = {
  populated: { stats: populatedStats, incidents: populatedIncidents, activity: populatedActivity, pipelines: populatedPipelines },
  healthy:   { stats: healthyStats,   incidents: [],                  activity: populatedActivity, pipelines: healthyPipelines },
  incident:  { stats: incidentStats,  incidents: incidentIncidents,   activity: incidentActivity,  pipelines: incidentPipelines },
}

export function getDashboardScenario(raw?: string | null): ScenarioData {
  const key = (raw ?? 'populated') as Scenario
  return scenarios[key] ?? scenarios.populated
}
