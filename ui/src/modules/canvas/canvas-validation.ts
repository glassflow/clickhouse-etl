import type { Edge, Node } from '@xyflow/react'

export type ValidationSeverity = 'error' | 'warning'

export type ValidationMessage = {
  code: string
  severity: ValidationSeverity
  message: string
  field?: string
}

export type ValidationResult = {
  byNode: Record<string, ValidationMessage[]>
  byEdge: Record<string, ValidationMessage[]>
  summary: {
    errorCount: number
    warningCount: number
    hasErrors: boolean
  }
}

const SOURCE_TYPES = new Set(['kafkaSource', 'otlpSource'])
const SINK_TYPES = new Set(['clickhouseSink'])
const TRANSFORM_TYPES = new Set(['dedup', 'filter', 'transform', 'join'])

type NodeConfigs = Record<string, Record<string, unknown>>

export function validateCanvas(
  nodes: Node[],
  edges: Edge[],
  configs: NodeConfigs,
): ValidationResult {
  const byNode: Record<string, ValidationMessage[]> = Object.fromEntries(
    nodes.map((n) => [n.id, []]),
  )
  const byEdge: Record<string, ValidationMessage[]> = {}

  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  for (const e of edges) {
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1)
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
  }

  for (const n of nodes) {
    const cfg = configs[n.id] ?? {}
    const isSource = SOURCE_TYPES.has(n.type ?? '')
    const isSink = SINK_TYPES.has(n.type ?? '')
    const isTransform = TRANSFORM_TYPES.has(n.type ?? '')

    // Connection topology
    if (isSource && (outgoing.get(n.id) ?? 0) === 0) {
      byNode[n.id].push({
        code: 'unconnected_output',
        severity: 'warning',
        message: 'Source has no downstream connection.',
      })
    }
    if (isSink && (incoming.get(n.id) ?? 0) === 0) {
      byNode[n.id].push({
        code: 'unconnected_input',
        severity: 'error',
        message: 'Sink has no upstream connection.',
      })
    }
    if (isTransform) {
      if ((incoming.get(n.id) ?? 0) === 0) {
        byNode[n.id].push({
          code: 'unconnected_input',
          severity: 'error',
          message: 'Transform requires an upstream input.',
        })
      }
      if ((outgoing.get(n.id) ?? 0) === 0) {
        byNode[n.id].push({
          code: 'unconnected_output',
          severity: 'warning',
          message: 'Transform output not consumed.',
        })
      }
    }

    // Required fields per node type
    if (n.type === 'kafkaSource') {
      if (!cfg.connectionRefId) {
        byNode[n.id].push({
          code: 'missing_required',
          severity: 'error',
          message: 'Select a Kafka connection.',
          field: 'connectionRefId',
        })
      }
      const topics = (cfg.topics as Array<{ name?: string }> | undefined) ?? []
      if (topics.length === 0) {
        byNode[n.id].push({
          code: 'missing_required',
          severity: 'error',
          message: 'At least one topic is required.',
          field: 'topics',
        })
      }
    }

    if (n.type === 'otlpSource') {
      if (!cfg.signal) {
        byNode[n.id].push({
          code: 'missing_required',
          severity: 'error',
          message: 'Select an OTLP signal (logs/traces/metrics).',
          field: 'signal',
        })
      }
    }

    if (n.type === 'clickhouseSink') {
      if (!cfg.connectionRefId) {
        byNode[n.id].push({
          code: 'missing_required',
          severity: 'error',
          message: 'Select a ClickHouse connection.',
          field: 'connectionRefId',
        })
      }
      if (!cfg.database) {
        byNode[n.id].push({
          code: 'missing_required',
          severity: 'error',
          message: 'Database is required.',
          field: 'database',
        })
      }
      if (!cfg.table) {
        byNode[n.id].push({
          code: 'missing_required',
          severity: 'error',
          message: 'Table is required.',
          field: 'table',
        })
      }
    }
  }

  const all = Object.values(byNode).flat()
  const errorCount = all.filter((m) => m.severity === 'error').length
  const warningCount = all.filter((m) => m.severity === 'warning').length

  return {
    byNode,
    byEdge,
    summary: { errorCount, warningCount, hasErrors: errorCount > 0 },
  }
}
