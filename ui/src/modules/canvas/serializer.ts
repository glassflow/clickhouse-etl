import type { Edge, Node } from '@xyflow/react'
import type { CanvasState } from '@/src/store/canvas.store'
import type { InternalPipelineConfig } from '@/src/types/pipeline'

/**
 * Shape used by the canvas editor when calling out to deploy/serialize.
 * Mirrors the relevant portion of `CanvasState` so callers can pass either
 * the full canvas store or a derived snapshot.
 */
export interface CanvasSerializeInput {
  nodes: Node[]
  edges: Edge[]
  configs: Record<string, Record<string, unknown>>
  sourceType?: CanvasState['sourceType']
}

/**
 * Converts the current canvas state into an InternalPipelineConfig shape.
 * Only includes nodes that are not disabled (active nodes contribute to the pipeline).
 * Source and sink configs are always included regardless of disabled state.
 */
export function canvasToPipelineConfig(canvas: CanvasState): InternalPipelineConfig {
  const { nodes, nodeConfigs } = canvas

  // Find source node type
  const sourceNode = nodes.find((n) => n.id === 'source')
  const dedupNode = nodes.find((n) => n.id === 'dedup')
  const filterNode = nodes.find((n) => n.id === 'filter')
  const transformNode = nodes.find((n) => n.id === 'transform')

  const sourceConfig = nodeConfigs['source'] ?? {}
  const sinkConfig = nodeConfigs['sink'] ?? {}
  const dedupConfig = nodeConfigs['dedup'] ?? {}
  const filterConfig = nodeConfigs['filter'] ?? {}
  const transformConfig = nodeConfigs['transform'] ?? {}

  const isDedupActive = dedupNode && !dedupNode.data.disabled
  const isFilterActive = filterNode && !filterNode.data.disabled
  const isTransformActive = transformNode && !transformNode.data.disabled

  const isOtlp = sourceNode?.type === 'otlpSource'

  const sourceType = isOtlp ? (canvas.sourceType as string) : 'kafka'

  const brokers =
    typeof sourceConfig.bootstrapServers === 'string'
      ? sourceConfig.bootstrapServers.split(',').map((s) => s.trim()).filter(Boolean)
      : []

  const topicName = typeof sourceConfig.topicName === 'string' ? sourceConfig.topicName : ''

  return {
    pipeline_id: '',
    name: '',
    source: isOtlp
      ? {
          type: sourceType,
          id: typeof sourceConfig.endpoint === 'string' ? sourceConfig.endpoint : '',
        }
      : {
          type: 'kafka',
          connection_params: {
            brokers,
            protocol: 'PLAINTEXT',
            mechanism: 'PLAIN',
          },
          topics: topicName
            ? [
                {
                  name: topicName,
                  id: topicName,
                  schema: { type: 'json', fields: [] },
                  consumer_group_initial_offset: 'latest',
                  deduplication: {
                    enabled: Boolean(isDedupActive),
                    id_field: typeof dedupConfig.idField === 'string' ? dedupConfig.idField : '',
                    id_field_type: 'string',
                    time_window: typeof dedupConfig.timeWindow === 'string' ? dedupConfig.timeWindow : '24h',
                  },
                },
              ]
            : [],
        },
    join: {
      enabled: false,
    },
    filter: isFilterActive
      ? {
          enabled: true,
          expression: typeof filterConfig.expression === 'string' ? filterConfig.expression : '',
        }
      : undefined,
    stateless_transformation: isTransformActive
      ? {
          enabled: true,
          config: {
            transform:
              typeof transformConfig.expression === 'string'
                ? [{ expression: transformConfig.expression, output_name: '', output_type: 'string' }]
                : [],
          },
        }
      : undefined,
    sink: {
      type: 'clickhouse',
      host: typeof sinkConfig.host === 'string' ? sinkConfig.host : '',
      httpPort: typeof sinkConfig.httpPort === 'string' ? sinkConfig.httpPort : '8123',
      database: typeof sinkConfig.database === 'string' ? sinkConfig.database : '',
      table: typeof sinkConfig.table === 'string' ? sinkConfig.table : '',
      secure: Boolean(sinkConfig.secure),
      table_mapping: [],
      max_batch_size: typeof sinkConfig.maxBatchSize === 'number' ? sinkConfig.maxBatchSize : 1000,
      max_delay_time: typeof sinkConfig.maxDelayTime === 'string' ? sinkConfig.maxDelayTime : '1s',
      skip_certificate_verification: Boolean(sinkConfig.skipCertificateVerification),
    },
  }
}

export type PipelineReferenceItem = {
  resourceKind: 'kafka_connection' | 'clickhouse_connection' | 'schema' | 'transform'
  resourceId: string
  pinnedVersion: string | null
}

/**
 * Walks `nodeConfigs` for the fixed canvas node IDs (source, sink, transform)
 * and collects any library resource IDs that were attached via the Library
 * Sidebar or NodeConfigPanel. Called just before a POST /revisions so the
 * server can persist `pipeline_references` rows in the same transaction.
 */
export function extractLibraryReferences(
  nodeConfigs: Record<string, Record<string, unknown>>,
): PipelineReferenceItem[] {
  const refs: PipelineReferenceItem[] = []

  const source = nodeConfigs['source'] as
    | { connectionRefId?: string; topics?: Array<{ schemaRefId?: string; pinnedVersion?: string }> }
    | undefined
  if (typeof source?.connectionRefId === 'string') {
    refs.push({ resourceKind: 'kafka_connection', resourceId: source.connectionRefId, pinnedVersion: null })
  }
  source?.topics?.forEach((t) => {
    if (typeof t.schemaRefId === 'string') {
      refs.push({ resourceKind: 'schema', resourceId: t.schemaRefId, pinnedVersion: t.pinnedVersion ?? null })
    }
  })

  const sink = nodeConfigs['sink'] as
    | { connectionRefId?: string; schemaRefId?: string; pinnedSchemaVersion?: string }
    | undefined
  if (typeof sink?.connectionRefId === 'string') {
    refs.push({ resourceKind: 'clickhouse_connection', resourceId: sink.connectionRefId, pinnedVersion: null })
  }
  if (typeof sink?.schemaRefId === 'string') {
    refs.push({ resourceKind: 'schema', resourceId: sink.schemaRefId, pinnedVersion: sink.pinnedSchemaVersion ?? null })
  }

  const transform = nodeConfigs['transform'] as
    | { transformRefId?: string; pinnedVersion?: string }
    | undefined
  if (typeof transform?.transformRefId === 'string') {
    refs.push({ resourceKind: 'transform', resourceId: transform.transformRefId, pinnedVersion: transform.pinnedVersion ?? null })
  }

  return refs
}

/**
 * Convenience wrapper around `canvasToPipelineConfig` for callers that hold
 * a raw `{ nodes, edges, configs }` snapshot rather than a full `CanvasState`.
 */
export function serializeCanvas(input: CanvasSerializeInput): InternalPipelineConfig {
  return canvasToPipelineConfig({
    nodes: input.nodes,
    edges: input.edges,
    nodeConfigs: input.configs,
    sourceType: input.sourceType ?? 'kafka',
    activeNodeId: null,
  } as CanvasState)
}

export interface CanvasHydration {
  nodes: Node[]
  edges: Edge[]
  nodeConfigs: Record<string, Record<string, unknown>>
  sourceType: CanvasState['sourceType']
}

const VALID_OTLP_SOURCE_TYPES = ['otlp.logs', 'otlp.traces', 'otlp.metrics'] as const
type OtlpSourceType = (typeof VALID_OTLP_SOURCE_TYPES)[number]

export function pipelineConfigToCanvas(config: InternalPipelineConfig): CanvasHydration {
  const isOtlp = config.source?.type !== 'kafka'
  const rawType = config.source?.type
  const sourceType: CanvasState['sourceType'] = isOtlp
    ? (VALID_OTLP_SOURCE_TYPES.includes(rawType as OtlpSourceType)
        ? (rawType as OtlpSourceType)
        : 'otlp.logs')
    : 'kafka'
  const sourceNodeType = isOtlp ? 'otlpSource' : 'kafkaSource'

  const topic = config.source?.topics?.[0]
  const isDedupActive = topic?.deduplication?.enabled ?? false
  const isFilterActive = config.filter?.enabled ?? false
  const isTransformActive = config.stateless_transformation?.enabled ?? false

  const nodes: Node[] = [
    {
      id: 'source',
      type: sourceNodeType,
      position: { x: 0, y: 200 },
      data: { label: isOtlp ? 'OTLP Source' : 'Kafka Source' },
    },
    {
      id: 'dedup',
      type: 'dedup',
      position: { x: 250, y: 200 },
      data: { label: 'Deduplication', disabled: !isDedupActive },
    },
    {
      id: 'filter',
      type: 'filter',
      position: { x: 500, y: 200 },
      data: { label: 'Filter', disabled: !isFilterActive },
    },
    {
      id: 'transform',
      type: 'transform',
      position: { x: 750, y: 200 },
      data: { label: 'Transform', disabled: !isTransformActive },
    },
    {
      id: 'sink',
      type: 'clickhouseSink',
      position: { x: 1000, y: 200 },
      data: { label: 'ClickHouse Sink' },
    },
  ]

  const edges: Edge[] = [
    { id: 'e-source-dedup', source: 'source', target: 'dedup' },
    { id: 'e-dedup-filter', source: 'dedup', target: 'filter' },
    { id: 'e-filter-transform', source: 'filter', target: 'transform' },
    { id: 'e-transform-sink', source: 'transform', target: 'sink' },
  ]

  const brokers = config.source?.connection_params?.brokers ?? []
  const sourceConfig: Record<string, unknown> = isOtlp
    ? { endpoint: config.source?.id ?? '' }
    : {
        bootstrapServers: brokers.join(','),
        topicName: topic?.name ?? '',
      }

  const dedupConfig: Record<string, unknown> = {
    idField: topic?.deduplication?.id_field ?? '',
    timeWindow: topic?.deduplication?.time_window ?? '24h',
  }

  const filterConfig: Record<string, unknown> = {
    expression: config.filter?.expression ?? '',
  }

  const transformConfig: Record<string, unknown> = {
    expression:
      config.stateless_transformation?.config?.transform?.[0]?.expression ?? '',
  }

  const sink = config.sink
  const sinkConfig: Record<string, unknown> = {
    host: sink?.host ?? '',
    httpPort: sink?.httpPort ?? '8123',
    database: sink?.database ?? '',
    table: sink?.table ?? '',
    secure: sink?.secure ?? false,
    maxBatchSize: sink?.max_batch_size ?? 1000,
    maxDelayTime: sink?.max_delay_time ?? '1s',
    skipCertificateVerification: sink?.skip_certificate_verification ?? false,
  }

  return {
    nodes,
    edges,
    nodeConfigs: {
      source: sourceConfig,
      dedup: dedupConfig,
      filter: filterConfig,
      transform: transformConfig,
      sink: sinkConfig,
    },
    sourceType,
  }
}
