import { describe, it, expect } from 'vitest'
import { extractLibraryReferences, pipelineConfigToCanvas } from '../serializer'
import type { InternalPipelineConfig } from '@/src/types/pipeline'

describe('extractLibraryReferences', () => {
  it('returns empty array when no refs are set', () => {
    expect(extractLibraryReferences({})).toEqual([])
    expect(extractLibraryReferences({ source: {}, sink: {}, transform: {} })).toEqual([])
  })

  it('extracts kafka_connection from source.connectionRefId', () => {
    const refs = extractLibraryReferences({
      source: { connectionRefId: 'kafka-uuid-1' },
    })
    expect(refs).toEqual([
      { resourceKind: 'kafka_connection', resourceId: 'kafka-uuid-1', pinnedVersion: null },
    ])
  })

  it('extracts schema refs from source.topics', () => {
    const refs = extractLibraryReferences({
      source: {
        topics: [
          { schemaRefId: 'schema-uuid-1', pinnedVersion: 'v1.2.0' },
          { schemaRefId: 'schema-uuid-2' },
        ],
      },
    })
    expect(refs).toEqual([
      { resourceKind: 'schema', resourceId: 'schema-uuid-1', pinnedVersion: 'v1.2.0' },
      { resourceKind: 'schema', resourceId: 'schema-uuid-2', pinnedVersion: null },
    ])
  })

  it('skips topics without schemaRefId', () => {
    const refs = extractLibraryReferences({
      source: { topics: [{ pinnedVersion: 'v1' }, { schemaRefId: 'schema-uuid-3' }] },
    })
    expect(refs).toEqual([
      { resourceKind: 'schema', resourceId: 'schema-uuid-3', pinnedVersion: null },
    ])
  })

  it('extracts clickhouse_connection from sink.connectionRefId', () => {
    const refs = extractLibraryReferences({
      sink: { connectionRefId: 'ch-uuid-1' },
    })
    expect(refs).toEqual([
      { resourceKind: 'clickhouse_connection', resourceId: 'ch-uuid-1', pinnedVersion: null },
    ])
  })

  it('extracts schema from sink.schemaRefId with pinnedSchemaVersion', () => {
    const refs = extractLibraryReferences({
      sink: { schemaRefId: 'schema-uuid-4', pinnedSchemaVersion: 'v2.0.0' },
    })
    expect(refs).toEqual([
      { resourceKind: 'schema', resourceId: 'schema-uuid-4', pinnedVersion: 'v2.0.0' },
    ])
  })

  it('extracts transform ref', () => {
    const refs = extractLibraryReferences({
      transform: { transformRefId: 'transform-uuid-1', pinnedVersion: 'v3.1.0' },
    })
    expect(refs).toEqual([
      { resourceKind: 'transform', resourceId: 'transform-uuid-1', pinnedVersion: 'v3.1.0' },
    ])
  })

  it('extracts all refs in a fully wired canvas', () => {
    const refs = extractLibraryReferences({
      source: {
        connectionRefId: 'kafka-uuid-1',
        topics: [{ schemaRefId: 'schema-uuid-1', pinnedVersion: 'v1.0.0' }],
      },
      sink: { connectionRefId: 'ch-uuid-1', schemaRefId: 'schema-uuid-2', pinnedSchemaVersion: 'v2.0.0' },
      transform: { transformRefId: 'transform-uuid-1', pinnedVersion: 'v1.0.0' },
    })
    expect(refs).toHaveLength(5)
    expect(refs.map((r) => r.resourceKind)).toEqual([
      'kafka_connection',
      'schema',
      'clickhouse_connection',
      'schema',
      'transform',
    ])
  })
})

const baseKafkaConfig = (): InternalPipelineConfig => ({
  pipeline_id: '',
  name: '',
  source: {
    type: 'kafka',
    connection_params: {
      brokers: ['broker1:9092', 'broker2:9092'],
      protocol: 'PLAINTEXT',
      mechanism: 'PLAIN',
    },
    topics: [
      {
        name: 'orders',
        id: 'orders',
        schema: { type: 'json', fields: [] },
        consumer_group_initial_offset: 'latest',
        deduplication: {
          enabled: false,
          id_field: '',
          id_field_type: 'string',
          time_window: '24h',
        },
      },
    ],
  },
  join: { enabled: false },
  sink: {
    type: 'clickhouse',
    host: 'ch.example.com',
    httpPort: '8123',
    database: 'analytics',
    table: 'events',
    secure: true,
    table_mapping: [],
    max_batch_size: 500,
    max_delay_time: '2s',
    skip_certificate_verification: false,
  },
})

describe('pipelineConfigToCanvas', () => {
  it('produces fixed node IDs matching buildDefaultPipeline', () => {
    const { nodes } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(nodes.map((n) => n.id)).toEqual(['source', 'dedup', 'filter', 'transform', 'sink'])
  })

  it('produces fixed edge set matching buildDefaultPipeline', () => {
    const { edges } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(edges.map((e) => e.id)).toEqual([
      'e-source-dedup',
      'e-dedup-filter',
      'e-filter-transform',
      'e-transform-sink',
    ])
  })

  it('maps kafka brokers to bootstrapServers (joined)', () => {
    const { nodeConfigs } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(nodeConfigs['source']?.bootstrapServers).toBe('broker1:9092,broker2:9092')
  })

  it('maps topic name to topicName', () => {
    const { nodeConfigs } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(nodeConfigs['source']?.topicName).toBe('orders')
  })

  it('dedup node is disabled when deduplication.enabled is false', () => {
    const { nodes } = pipelineConfigToCanvas(baseKafkaConfig())
    const dedup = nodes.find((n) => n.id === 'dedup')
    expect(dedup?.data.disabled).toBe(true)
  })

  it('dedup node is active when deduplication.enabled is true', () => {
    const config = baseKafkaConfig()
    config.source.topics![0].deduplication.enabled = true
    config.source.topics![0].deduplication.id_field = 'order_id'
    config.source.topics![0].deduplication.time_window = '12h'
    const { nodes, nodeConfigs } = pipelineConfigToCanvas(config)
    const dedup = nodes.find((n) => n.id === 'dedup')
    expect(dedup?.data.disabled).toBe(false)
    expect(nodeConfigs['dedup']?.idField).toBe('order_id')
    expect(nodeConfigs['dedup']?.timeWindow).toBe('12h')
  })

  it('filter node is active when filter.enabled is true', () => {
    const config = baseKafkaConfig()
    config.filter = { enabled: true, expression: 'amount > 0' }
    const { nodes, nodeConfigs } = pipelineConfigToCanvas(config)
    const filter = nodes.find((n) => n.id === 'filter')
    expect(filter?.data.disabled).toBe(false)
    expect(nodeConfigs['filter']?.expression).toBe('amount > 0')
  })

  it('transform node is active when stateless_transformation.enabled is true', () => {
    const config = baseKafkaConfig()
    config.stateless_transformation = {
      enabled: true,
      config: { transform: [{ expression: 'upper(name)', output_name: 'name', output_type: 'string' }] },
    }
    const { nodes, nodeConfigs } = pipelineConfigToCanvas(config)
    const transform = nodes.find((n) => n.id === 'transform')
    expect(transform?.data.disabled).toBe(false)
    expect(nodeConfigs['transform']?.expression).toBe('upper(name)')
  })

  it('maps sink fields correctly', () => {
    const { nodeConfigs } = pipelineConfigToCanvas(baseKafkaConfig())
    const sink = nodeConfigs['sink']
    expect(sink?.host).toBe('ch.example.com')
    expect(sink?.database).toBe('analytics')
    expect(sink?.table).toBe('events')
    expect(sink?.secure).toBe(true)
    expect(sink?.maxBatchSize).toBe(500)
    expect(sink?.maxDelayTime).toBe('2s')
  })

  it('sets sourceType to "kafka" for kafka source', () => {
    const { sourceType } = pipelineConfigToCanvas(baseKafkaConfig())
    expect(sourceType).toBe('kafka')
  })

  it('maps OTLP source endpoint and sets sourceType', () => {
    const config = baseKafkaConfig()
    config.source = { type: 'otlp.logs', id: 'http://collector:4318' }
    const { nodes, nodeConfigs, sourceType } = pipelineConfigToCanvas(config)
    expect(sourceType).toBe('otlp.logs')
    expect(nodes.find((n) => n.id === 'source')?.type).toBe('otlpSource')
    expect(nodeConfigs['source']?.endpoint).toBe('http://collector:4318')
  })

  it('round-trip: pipelineConfigToCanvas preserves key fields', () => {
    const config = baseKafkaConfig()
    config.source.topics![0].deduplication.enabled = true
    config.source.topics![0].deduplication.id_field = 'id'
    config.filter = { enabled: true, expression: 'x > 0' }
    const hydration = pipelineConfigToCanvas(config)
    expect(hydration.nodeConfigs['source']?.topicName).toBe('orders')
    expect(hydration.nodeConfigs['dedup']?.idField).toBe('id')
    expect(hydration.nodeConfigs['filter']?.expression).toBe('x > 0')
    expect(hydration.nodeConfigs['sink']?.host).toBe('ch.example.com')
  })
})
