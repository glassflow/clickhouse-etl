/**
 * Deterministic stub enrichment for pipeline list rows.
 * Produces stable, realistic-looking data seeded from pipeline_id.
 * Replace individual fields as real backend data becomes available.
 */

import type { ListPipelineConfig, PipelineStatus } from '@/src/types/pipeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineEnv = 'PROD' | 'STAGING' | 'DEV'

export interface PipelineOwner {
  name: string
  team: string
  initials: string
  colorToken: string
}

export interface PipelineStubs {
  env: PipelineEnv
  sourceLabel: string
  sinkLabel: string
  throughput: number
  throughputSpark: number[]
  owner: PipelineOwner
  lastDeployUser: string
  lastDeployTime: string
  diagnostic: string | null
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const ENVS: PipelineEnv[] = ['PROD', 'PROD', 'PROD', 'PROD', 'STAGING', 'STAGING', 'DEV']

const OWNERS: PipelineOwner[] = [
  { name: 'Alex Rivera', team: 'team:checkout',  initials: 'AR', colorToken: 'var(--color-foreground-primary)' },
  { name: 'Jin Kim',     team: 'team:platform',  initials: 'JK', colorToken: 'var(--color-foreground-info)' },
  { name: 'Sam Reed',    team: 'team:growth',    initials: 'SR', colorToken: 'var(--color-foreground-positive)' },
  { name: 'Pat Singh',   team: 'team:risk',      initials: 'PS', colorToken: 'var(--color-purple-300)' },
  { name: 'Mira Park',   team: 'team:data',      initials: 'MP', colorToken: 'var(--color-yellow-400)' },
]

const DEPLOY_USERS = ['alex@', 'jin@', 'sam@', 'pat@', 'mira@']
const DEPLOY_TIMES = ['14:21 today', '12d ago', '3d ago', '129d ago', '1d ago', '23m ago', '14:43 today', '7d ago', '2h ago', '30m ago']

const FAIL_DIAGNOSTICS = [
  'schema mismatch → v3 pinned',
  'consumer lag > threshold',
  'connection refused: broker unreachable',
  'sink write timeout after 30s',
  'partition assignment failed',
  'schema evolution blocked',
]

const WARN_DIAGNOSTICS = [
  'reads removed legacy_total',
  'amount narrowing · 99.4% parse',
  'DLQ drain in progress',
  'backpressure on sink channel',
  'offset commit delay > 5s',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
  }
  return h >>> 0
}

function pick<T>(arr: readonly T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length]
}

function genSparkline(seed: number, active: boolean, points = 14): number[] {
  if (!active) return Array(points).fill(0)
  const data: number[] = []
  let v = 3000 + (seed % 20000)
  for (let i = 0; i < points; i++) {
    v = Math.max(0, v + (((seed * (i + 3)) % 4000) - 1800))
    data.push(v)
  }
  return data
}

function deriveTopology(name: string, transformationType: string): { sourceLabel: string; sinkLabel: string } {
  const parts = name.toLowerCase().split('-')
  const domain = parts[0] || 'data'
  const isPostgres = name.includes('cdc') || name.includes('inventory')
  const isArchive  = name.includes('archive') || name.includes('replay')
  const isFanout   = name.includes('fanout') || name.includes('-cs') || name.includes('-audit')
  const isKafkaOut = transformationType.includes('Join') || isFanout

  const sourceType  = isPostgres ? 'pg' : 'kafka'
  const eventSuffix = name.includes('raw') || name.includes('cdc') ? '.raw' : '.events'
  const sourceLabel = `${sourceType}:${domain}${eventSuffix}`

  let sinkLabel: string
  if (isArchive) {
    sinkLabel = `s3://arch-${domain}`
  } else if (isFanout) {
    sinkLabel = `kafka:${parts[parts.length - 1] || domain}`
  } else if (isKafkaOut) {
    sinkLabel = `kafka:${domain}-${parts[1] || 'out'}`
  } else {
    const suffix = parts.slice(1, 3).join('_') || 'tbl'
    sinkLabel = `ch:${domain}_${suffix}`
  }

  return { sourceLabel, sinkLabel }
}

// ─── Main export ──────────────────────────────────────────────────────────────

const cache = new Map<string, PipelineStubs>()

export function enrichPipeline(p: ListPipelineConfig, effectiveStatus?: PipelineStatus): PipelineStubs {
  const key = p.pipeline_id || p.name
  if (cache.has(key)) return cache.get(key)!

  const h = hash(key)
  const isActive  = !effectiveStatus || effectiveStatus === 'active'
  const isFailed  = effectiveStatus === 'failed'
  const isUnstable = p.health_status === 'unstable' && !isFailed

  const { sourceLabel, sinkLabel } = deriveTopology(p.name, p.transformation_type || '')

  let diagnostic: string | null = null
  if (isFailed)  diagnostic = pick(FAIL_DIAGNOSTICS, h)
  else if (isUnstable) diagnostic = pick(WARN_DIAGNOSTICS, h, 1)

  const stubs: PipelineStubs = {
    env:            pick(ENVS, h) as PipelineEnv,
    sourceLabel,
    sinkLabel,
    throughput:     isActive ? (h % 24000) : 0,
    throughputSpark: genSparkline(h, isActive),
    owner:          pick(OWNERS, h),
    lastDeployUser: pick(DEPLOY_USERS, h, 1),
    lastDeployTime: pick(DEPLOY_TIMES, h, 2),
    diagnostic,
  }

  cache.set(key, stubs)
  return stubs
}

export function clearEnrichCache(): void {
  cache.clear()
}
