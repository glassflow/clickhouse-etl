import type { CanvasState } from '@/src/store/canvas.store'
import type { InternalPipelineConfig } from '@/src/types/pipeline'

/**
 * Converts the current canvas state into an InternalPipelineConfig shape.
 * Only includes nodes that are not disabled (active nodes contribute to the pipeline).
 * Source and sink configs are always included regardless of disabled state.
 */
export function canvasToPipelineConfig(canvas: CanvasState): InternalPipelineConfig {
  const { nodes, nodeConfigs } = canvas

  // Find source node type
  const sourceNode = nodes.find((n) => n.id === 'source')
  const sinkNode = nodes.find((n) => n.id === 'sink')
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
