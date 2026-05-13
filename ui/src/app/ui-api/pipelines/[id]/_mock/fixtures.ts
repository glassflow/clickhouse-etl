/**
 * Mock fixtures for the per-pipeline observability surface.
 *
 * Activated when `NEXT_PUBLIC_USE_MOCK_API=true` so the Metrics/Logs tabs
 * render without VictoriaMetrics/VictoriaLogs reachable. The shapes here MUST
 * match the real route responses exactly — see `metrics/route.ts` and
 * `logs/route.ts` for the contracts.
 */

import { CANONICAL_QUERIES, isCanonicalKey } from '../metrics/_lib/canonical-queries'

export type MockScenario = 'populated' | 'empty' | 'retention' | 'error'

export function parseScenario(raw: string | null | undefined): MockScenario {
  if (raw === 'empty' || raw === 'retention' || raw === 'error') return raw
  return 'populated'
}

// ────────────────────────────────────────────────────────────────────────────
// Seeded PRNG so the same (pipelineId, query) renders the same shape across
// auto-refresh ticks — no flicker, but distinct pipelines look distinct.
// ────────────────────────────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function parseStepSeconds(step: string | undefined): number {
  if (!step) return 30
  const m = step.match(/^(\d+)([smhd])?$/)
  if (!m) return 30
  const n = Number(m[1])
  const unit = m[2] ?? 's'
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400
  return Math.max(1, n * mult)
}

// ────────────────────────────────────────────────────────────────────────────
// Metric series shapes per canonical query.
// Returns multiple series where the dashboard renders a breakdown by
// `component` (ingestor / processor / sink); single series otherwise.
// ────────────────────────────────────────────────────────────────────────────

type SeriesSpec = {
  // base value at center of typical range
  base: number
  // peak-to-trough amplitude as a fraction of base
  amplitude: number
  // optional spike at this fraction of the window (0..1)
  spikeAt?: number
  // spike multiplier relative to base
  spikeMult?: number
  // labels carried on the series
  labels: Record<string, string>
  // numeric precision for the stringified value
  precision?: number
}

function specsFor(query: string): SeriesSpec[] {
  // The dashboard's "by component" breakdown reads label `component` —
  // emit one series per stage for throughput/latency families.
  const byComponent = (base: number, opts: Partial<SeriesSpec> = {}): SeriesSpec[] => [
    { base, amplitude: 0.18, labels: { component: 'ingestor' }, ...opts },
    {
      base: base * 0.94,
      amplitude: 0.22,
      labels: { component: 'processor' },
      ...opts,
    },
    {
      base: base * 0.92,
      amplitude: 0.2,
      labels: { component: 'sink' },
      ...opts,
    },
  ]

  switch (query) {
    case 'records_ingested':
      return byComponent(4218, { spikeAt: 0.72, spikeMult: 1.35, precision: 0 })
    case 'records_processed':
      return byComponent(4100, { spikeAt: 0.72, spikeMult: 1.3, precision: 0 })
    case 'records_sunk':
      return byComponent(4154, { spikeAt: 0.72, spikeMult: 1.28, precision: 0 })
    case 'latency_p50':
      return [{ base: 0.034, amplitude: 0.25, labels: {}, precision: 4 }]
    case 'latency_p95':
      return [
        {
          base: 0.092,
          amplitude: 0.3,
          spikeAt: 0.72,
          spikeMult: 3.4,
          labels: {},
          precision: 4,
        },
      ]
    case 'latency_p99':
      return [
        {
          base: 0.184,
          amplitude: 0.3,
          spikeAt: 0.72,
          spikeMult: 1.7,
          labels: {},
          precision: 4,
        },
      ]
    case 'errors_total':
      return [{ base: 0.02, amplitude: 1.4, labels: {}, precision: 4 }]
    case 'dlq_rate':
      return [
        {
          base: 0.4,
          amplitude: 0.6,
          spikeAt: 0.7,
          spikeMult: 20,
          labels: {},
          precision: 3,
        },
      ]
    case 'consumer_lag':
      return [{ base: 1200, amplitude: 0.5, labels: {}, precision: 0 }]
    default:
      return [{ base: 1, amplitude: 0.3, labels: {}, precision: 3 }]
  }
}

export type MetricSeries = {
  metric: Record<string, string>
  values: Array<[number, string]>
}

export type MetricFixture = {
  promql: string
  query: string
  result: { resultType: 'matrix'; result: MetricSeries[] }
}

type BuildMetricsArgs = {
  pipelineId: string
  queryName: string
  rawQuery?: string | null
  fromMs: number
  toMs: number
  step?: string
  scenario: MockScenario
}

export function buildMetricsFixture(args: BuildMetricsArgs): MetricFixture {
  const { pipelineId, queryName, rawQuery, fromMs, toMs, step, scenario } = args

  const promql = rawQuery ? rawQuery : isCanonicalKey(queryName) ? CANONICAL_QUERIES[queryName] : queryName
  const queryLabel = rawQuery ? 'raw' : queryName

  if (scenario === 'empty') {
    return {
      promql,
      query: queryLabel,
      result: { resultType: 'matrix', result: [] },
    }
  }

  const stepSec = parseStepSeconds(step)
  const startSec = Math.floor(fromMs / 1000)
  const endSec = Math.floor(toMs / 1000)
  const totalSec = Math.max(stepSec, endSec - startSec)
  const bucketCount = Math.min(720, Math.max(2, Math.floor(totalSec / stepSec)))

  // Retention edge: only emit samples from the right ~55% of the window so
  // OBChartSVG draws the diagonal-hatched "outside retention" band on the left.
  const firstBucket = scenario === 'retention' ? Math.floor(bucketCount * 0.45) : 0

  const specs = specsFor(queryName)
  const result: MetricSeries[] = specs.map((spec, seriesIdx) => {
    const seed = hash(`${pipelineId}|${queryName}|${seriesIdx}`)
    const rand = mulberry32(seed)
    const values: Array<[number, string]> = []
    for (let b = firstBucket; b < bucketCount; b++) {
      const ts = startSec + b * stepSec
      const progress = b / bucketCount
      // Slow drift + per-bucket noise.
      const drift = Math.sin(progress * Math.PI * 2 + seriesIdx) * 0.08
      const noise = (rand() - 0.5) * spec.amplitude
      let v = spec.base * (1 + drift + noise)
      if (spec.spikeAt != null && spec.spikeMult != null) {
        // Narrow spike: 1-2 buckets at spikeAt.
        const distanceFromSpike = Math.abs(progress - spec.spikeAt)
        const spikeWidth = 2 / bucketCount
        if (distanceFromSpike < spikeWidth) {
          v = spec.base * spec.spikeMult * (1 - distanceFromSpike / spikeWidth)
        }
      }
      v = Math.max(0, v)
      values.push([ts, v.toFixed(spec.precision ?? 3)])
    }
    return { metric: { ...spec.labels, pipeline_id: pipelineId }, values }
  })

  return { promql, query: queryLabel, result: { resultType: 'matrix', result } }
}

// ────────────────────────────────────────────────────────────────────────────
// Logs fixture — shape matches LogsResponse from useLogsQuery.
// ────────────────────────────────────────────────────────────────────────────

export type LogLineFixture = {
  _time: string
  _msg: string
  pipeline_id: string
  component: string
  severity: 'info' | 'warn' | 'error' | 'debug'
  trace_id?: string
  span_id?: string
}

export type LogsFixture = {
  query: string
  lines: LogLineFixture[]
  count: number
}

type BuildLogsArgs = {
  pipelineId: string
  query: string
  fromMs: number
  toMs: number
  limit: number
  scenario: MockScenario
}

const COMPONENTS = ['ingestor', 'processor', 'sink', 'api', 'ui'] as const
const SEVERITY_DECK: LogLineFixture['severity'][] = [
  // weighted toward info; matches the bar-chart proportions in the screenshots
  'info',
  'info',
  'info',
  'info',
  'info',
  'info',
  'warn',
  'warn',
  'error',
  'debug',
]
const MESSAGE_BANK: Record<LogLineFixture['component'] | string, string[]> = {
  ingestor: [
    'consumed batch offset={offset} partition={partition} topic=orders',
    'kafka rebalance complete, member assignments updated',
    'committed offsets up to {offset} for consumer group glassflow-h8z9a',
    'high watermark advanced for topic=orders partition={partition}',
  ],
  processor: [
    'transformed {n} records in {ms}ms — schema=orders.v3',
    'dedup window evicted {n} keys older than 5m',
    'schema_mismatch: field "amount" expected Float64 got String — routing to DLQ',
    'json_parse_error: unexpected token at line 1 col 42 — routing to DLQ',
  ],
  sink: [
    'ch_insert ok rows={n} table=orders elapsed={ms}ms',
    'ch_insert_failed: code=241 MEMORY_LIMIT_EXCEEDED — retrying with backoff',
    'flushed buffer rows={n} bytes={bytes}',
  ],
  api: ['GET /api/pipelines/{pid} 200 in {ms}ms', 'auth context resolved subject={sub}'],
  ui: ['client reported metric query latency {ms}ms', 'feature flag observability enabled'],
}

export function buildLogsFixture(args: BuildLogsArgs): LogsFixture {
  const { pipelineId, query, fromMs, toMs, limit, scenario } = args

  if (scenario === 'empty') return { query, lines: [], count: 0 }

  const seed = hash(`${pipelineId}|logs|${fromMs}|${toMs}`)
  const rand = mulberry32(seed)
  const total = Math.min(limit, 80 + Math.floor(rand() * 140))
  const lines: LogLineFixture[] = []

  for (let i = 0; i < total; i++) {
    const t = fromMs + (toMs - fromMs) * (i / total) + (rand() - 0.5) * 1000
    const component = COMPONENTS[Math.floor(rand() * COMPONENTS.length)]
    const severity = SEVERITY_DECK[Math.floor(rand() * SEVERITY_DECK.length)]
    const tmpl = MESSAGE_BANK[component][Math.floor(rand() * MESSAGE_BANK[component].length)] ?? '…'
    const _msg = tmpl
      .replace('{offset}', String(1_000_000 + Math.floor(rand() * 100_000)))
      .replace('{partition}', String(Math.floor(rand() * 8)))
      .replace('{n}', String(Math.floor(rand() * 5000)))
      .replace('{ms}', String(8 + Math.floor(rand() * 280)))
      .replace('{bytes}', String(1024 * Math.floor(50 + rand() * 4000)))
      .replace('{pid}', pipelineId)
      .replace('{sub}', 'user-' + Math.floor(rand() * 1000))
    lines.push({
      _time: new Date(t).toISOString(),
      _msg,
      pipeline_id: pipelineId,
      component,
      severity,
      trace_id: severity === 'error' ? `tr-${Math.floor(rand() * 1e9).toString(16)}` : undefined,
    })
  }

  // Newest first — matches LogsTab default sort.
  lines.sort((a, b) => b._time.localeCompare(a._time))
  return { query, lines, count: lines.length }
}
