export type IncidentSeverity = 'crit' | 'warn' | 'info'

export type Incident = {
  id: string
  severity: IncidentSeverity
  pipelineName: string
  title: string
  description: string
  meta: string[]
  ctaLabel: string
  ctaHref?: string
}

export type ActivityKind = 'deploy' | 'fail' | 'pause' | 'info'

export type ActivityItem = {
  kind: ActivityKind
  text: string
  pipelineName?: string
  actor?: string
  relativeTime: string
}

export type DashPipelineStatus = 'run' | 'deg' | 'fail' | 'paused' | 'draft'

export type DashPipeline = {
  id: string
  name: string
  version: string
  sourceTopic: string
  destTable: string
  status: DashPipelineStatus
  statusLabel: string
  throughput: string
  throughputUnit: string
  lagP95: string
  lagUnit: string
  lagSeverity?: 'warn' | 'crit'
  dlq: string
  dlqSeverity?: 'warn' | 'crit'
  lastDeploy: string
  deployedBy: string
}

export type DashStats = {
  activePipelines: number
  totalPipelines: number
  eventsPerSec: number
  eventsPerSecDelta: number
  errorRate: number
  errorRateDelta: number
  dlqEvents: number
  dlqDelta: number
  avgLagMs: number
  avgLagMsDelta: number
  throughputIn: number
  throughputOut: number
  throughputLossPct: number
  throughputSeries: { in: number[]; out: number[] }
}

export type DashboardState =
  | { kind: 'first-run' }
  | { kind: 'healthy';   pipelines: DashPipeline[]; stats: DashStats; activity: ActivityItem[] }
  | { kind: 'populated'; pipelines: DashPipeline[]; stats: DashStats; incidents: Incident[]; activity: ActivityItem[] }
  | { kind: 'incident';  pipelines: DashPipeline[]; stats: DashStats; incidents: Incident[]; activity: ActivityItem[] }

export function determineDashboardState(
  pipelines: DashPipeline[],
  incidents: Incident[],
  stats: DashStats,
  activity: ActivityItem[],
): DashboardState {
  if (pipelines.length === 0) return { kind: 'first-run' }
  if (incidents.length === 0) return { kind: 'healthy', pipelines, stats, activity }
  const isIncident = incidents.length > 5 || pipelines.some((p) => p.status === 'fail')
  if (isIncident) return { kind: 'incident', pipelines, stats, incidents, activity }
  return { kind: 'populated', pipelines, stats, incidents, activity }
}
