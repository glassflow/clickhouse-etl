import { describe, it, expect } from 'vitest'
import { V3PipelineAdapter } from './v3'
import { InternalPipelineConfig } from '@/src/types/pipeline'
import { getPipelineAdapter } from './factory'
import { PipelineVersion } from '@/src/config/pipeline-versions'

describe('V3PipelineAdapter', () => {
  const adapter = new V3PipelineAdapter()

  // ── shared fixtures ─────────────────────────────────────────────────────────

  const kafkaSingleSourceConfig = {
    version: 'v3',
    pipeline_id: 'pipeline-1',
    name: 'Single Source',
    sources: [
      {
        type: 'kafka',
        source_id: 'orders',
        connection_params: { brokers: ['broker0'], protocol: 'PLAINTEXT', mechanism: 'NO_AUTH' },
        topic: 'orders',
        consumer_group_initial_offset: 'latest',
        schema_fields: [
          { name: 'order_id', type: 'string' },
          { name: 'amount', type: 'int' },
        ],
      },
    ],
    transforms: [
      { type: 'dedup', source_id: 'orders', config: { key: 'order_id', time_window: '1h' } },
      { type: 'filter', source_id: 'orders', config: { expression: 'amount > 100' } },
    ],
    sink: {
      type: 'clickhouse',
      connection_params: {
        host: 'ch-host',
        port: '9000',
        http_port: '8123',
        database: 'default',
        username: '',
        password: '',
        secure: false,
      },
      table: 'orders',
      source_id: 'orders',
      max_batch_size: 1000,
      max_delay_time: '1s',
      mapping: [
        { name: 'order_id', column_name: 'order_id', column_type: 'String' },
        { name: 'amount', column_name: 'amount', column_type: 'Int32' },
      ],
    },
  }

  // ── hydrate ──────────────────────────────────────────────────────────────────

  describe('hydrate', () => {
    it('converts sources[] to source.topics[] with schema and dedup', () => {
      const result = adapter.hydrate(kafkaSingleSourceConfig)

      expect(result.source.type).toBe('kafka')
      expect(result.source.topics).toHaveLength(1)

      const topic = result.source.topics![0]
      expect(topic.id).toBe('orders')
      expect(topic.name).toBe('orders')
      expect(topic.schema).toEqual({
        type: 'json',
        fields: [
          { name: 'order_id', type: 'string' },
          { name: 'amount', type: 'int' },
        ],
      })
      expect(topic.deduplication).toMatchObject({
        enabled: true,
        id_field: 'order_id',
        id_field_type: 'string',
        time_window: '1h',
      })
    })

    it('converts filter transform to internal filter', () => {
      const result = adapter.hydrate(kafkaSingleSourceConfig)
      expect(result.filter).toEqual({ enabled: true, expression: 'amount > 100' })
    })

    it('converts sink: connection_params → flat, mapping → table_mapping', () => {
      const result = adapter.hydrate(kafkaSingleSourceConfig)
      const sink = result.sink as any
      expect(sink.host).toBe('ch-host')
      expect(sink.port).toBe('9000')
      expect(sink.database).toBe('default')
      expect(result.sink.table_mapping).toEqual([
        { source_id: 'orders', field_name: 'order_id', column_name: 'order_id', column_type: 'String' },
        { source_id: 'orders', field_name: 'amount', column_name: 'amount', column_type: 'Int32' },
      ])
      expect((result.sink as any).connection_params).toBeUndefined()
      expect((result.sink as any).mapping).toBeUndefined()
    })

    it('converts stateless transform to internal transformation with fields', () => {
      const config = {
        ...kafkaSingleSourceConfig,
        transforms: [
          {
            type: 'stateless',
            source_id: 'orders',
            id: 'my-transform',
            config: {
              transforms: [
                { expression: 'order_id', output_name: 'order_id', output_type: 'string' },
                { expression: 'int(amount) % 2 == 0', output_name: 'is_even', output_type: 'bool' },
              ],
            },
          },
        ],
      }

      const result = adapter.hydrate(config)
      expect((result as any).transformation?.enabled).toBe(true)
      expect((result as any).transformation?.fields).toHaveLength(2)
      expect((result as any).transformation?.fields[0]).toMatchObject({
        type: 'passthrough',
        outputFieldName: 'order_id',
        sourceField: 'order_id',
      })
      expect((result as any).transformation?.fields[1]).toMatchObject({
        type: 'computed',
        outputFieldName: 'is_even',
        outputFieldType: 'bool',
      })
    })

    it('converts join.left_source/right_source to join.sources[] with orientation', () => {
      const config = {
        version: 'v3',
        pipeline_id: 'pipeline-join',
        name: 'Join Pipeline',
        sources: [
          {
            type: 'kafka',
            source_id: 'orders',
            connection_params: { brokers: [] },
            topic: 'orders',
            schema_fields: [{ name: 'order_id', type: 'string' }],
          },
          {
            type: 'kafka',
            source_id: 'users',
            connection_params: { brokers: [] },
            topic: 'users',
            schema_fields: [{ name: 'user_id', type: 'string' }],
          },
        ],
        transforms: [
          { type: 'dedup', source_id: 'orders', config: { key: 'order_id', time_window: '30s' } },
          { type: 'dedup', source_id: 'users', config: { key: 'user_id', time_window: '30s' } },
        ],
        join: {
          enabled: true,
          type: 'temporal',
          id: 'my-join',
          left_source: { source_id: 'orders', key: 'customer_id', time_window: '30s' },
          right_source: { source_id: 'users', key: 'user_id', time_window: '30s' },
          output_fields: [
            { source_id: 'orders', name: 'order_id', output_name: 'order_id' },
            { source_id: 'users', name: 'user_name', output_name: 'user_name' },
          ],
        },
        sink: {
          type: 'clickhouse',
          connection_params: { host: 'ch', port: '9000', http_port: '8123', database: 'default', secure: false },
          table: 'joined',
          source_id: 'my-join',
          mapping: [],
        },
      }

      const result = adapter.hydrate(config)

      expect(result.join.enabled).toBe(true)
      expect(result.join.sources).toHaveLength(2)
      expect(result.join.sources![0]).toMatchObject({
        source_id: 'orders',
        join_key: 'customer_id',
        time_window: '30s',
        orientation: 'left',
      })
      expect(result.join.sources![1]).toMatchObject({
        source_id: 'users',
        join_key: 'user_id',
        time_window: '30s',
        orientation: 'right',
      })
    })

    it('converts otlp source with dedup transform', () => {
      const config = {
        version: 'v3',
        pipeline_id: 'pipeline-otlp',
        name: 'OTLP Pipeline',
        sources: [{ type: 'otlp.traces', source_id: 'traces' }],
        transforms: [
          { type: 'dedup', source_id: 'traces', config: { key: 'trace_id', time_window: '1h' } },
        ],
        sink: {
          type: 'clickhouse',
          connection_params: { host: 'ch', port: '9000', http_port: '8123', database: 'default', secure: false },
          table: 'traces',
          source_id: 'traces',
          mapping: [{ name: 'trace_id', column_name: 'trace_id', column_type: 'String' }],
        },
      }

      const result = adapter.hydrate(config)

      expect(result.source.type).toBe('otlp.traces')
      expect((result.source as any).id).toBe('traces')
      expect(result.source.topics).toBeUndefined()
      expect((result.source as any).deduplication).toMatchObject({
        enabled: true,
        key: 'trace_id',
        time_window: '1h',
      })
    })

    it('converts resources.sources[] to pipeline_resources.ingestor.base (single source)', () => {
      const config = {
        ...kafkaSingleSourceConfig,
        resources: {
          nats: { stream: { maxAge: '24h' } },
          sources: [{ source_id: 'orders', replicas: 2, requests: { cpu: '100m', memory: '256Mi' } }],
          transform: [{ source_id: 'orders', replicas: 1, storage: { size: '1Gi' } }],
          sink: { replicas: 1 },
        },
      }

      const result = adapter.hydrate(config)
      const pr = result.pipeline_resources!
      expect(pr.nats).toEqual({ stream: { maxAge: '24h' } })
      expect(pr.ingestor?.base?.replicas).toBe(2)
      expect(pr.ingestor?.base?.requests).toEqual({ cpu: '100m', memory: '256Mi' })
      expect(pr.transform?.storage).toEqual({ size: '1Gi' })
    })
  })

  // ── generate ─────────────────────────────────────────────────────────────────

  describe('generate', () => {
    const singleSourceInternal: InternalPipelineConfig = {
      pipeline_id: 'pipeline-1',
      name: 'Single Source',
      source: {
        type: 'kafka',
        provider: 'custom',
        connection_params: { brokers: ['broker0'], protocol: 'PLAINTEXT', mechanism: 'NO_AUTH' },
        topics: [
          {
            id: 'orders',
            name: 'orders',
            consumer_group_initial_offset: 'latest',
            schema: { type: 'json', fields: [{ name: 'order_id', type: 'string' }, { name: 'amount', type: 'int' }] },
            deduplication: { enabled: true, id_field: 'order_id', id_field_type: 'string', time_window: '1h' },
          },
        ],
      },
      join: { type: 'temporal', enabled: false, sources: [] },
      filter: { enabled: true, expression: 'amount > 100' },
      sink: {
        type: 'clickhouse',
        host: 'ch-host',
        port: '9000',
        http_port: '8123',
        database: 'default',
        table: 'orders',
        secure: false,
        table_mapping: [
          { source_id: 'orders', field_name: 'order_id', column_name: 'order_id', column_type: 'String' },
          { source_id: 'orders', field_name: 'amount', column_name: 'amount', column_type: 'Int32' },
        ],
        max_batch_size: 1000,
        max_delay_time: '1s',
        skip_certificate_verification: false,
      } as any,
    }

    it('generates sources[] from source.topics[]', () => {
      const result = adapter.generate(singleSourceInternal)

      expect(result.version).toBe('v3')
      expect(result.sources).toHaveLength(1)
      expect(result.sources[0]).toMatchObject({
        type: 'kafka',
        source_id: 'orders',
        topic: 'orders',
        schema_fields: [
          { name: 'order_id', type: 'string' },
          { name: 'amount', type: 'int' },
        ],
      })
      expect(result.source).toBeUndefined()
    })

    it('generates transforms[] from dedup + filter', () => {
      const result = adapter.generate(singleSourceInternal)

      expect(result.transforms).toHaveLength(2)
      expect(result.transforms[0]).toMatchObject({
        type: 'dedup',
        source_id: 'orders',
        config: { key: 'order_id', time_window: '1h' },
      })
      expect(result.transforms[1]).toMatchObject({
        type: 'filter',
        source_id: 'orders',
        config: { expression: 'amount > 100' },
      })
    })

    it('generates sink with connection_params and mapping', () => {
      const result = adapter.generate(singleSourceInternal)

      expect(result.sink.connection_params).toMatchObject({
        host: 'ch-host',
        port: '9000',
        http_port: '8123',
        database: 'default',
      })
      expect(result.sink.mapping).toEqual([
        { name: 'order_id', column_name: 'order_id', column_type: 'String' },
        { name: 'amount', column_name: 'amount', column_type: 'Int32' },
      ])
      expect(result.sink.table_mapping).toBeUndefined()
    })

    it('omits join entirely for single-source pipelines', () => {
      const result = adapter.generate(singleSourceInternal)
      expect(result.join).toBeUndefined()
    })

    it('generates join.left_source / right_source from join.sources[] with orientation', () => {
      const internal: InternalPipelineConfig = {
        pipeline_id: 'pipeline-join',
        name: 'Join Pipeline',
        source: {
          type: 'kafka',
          connection_params: { brokers: [], protocol: 'PLAINTEXT', mechanism: 'NO_AUTH' },
          topics: [
            { id: 'orders', name: 'orders', schema: { type: 'json', fields: [] }, consumer_group_initial_offset: 'latest', deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '1h' } },
            { id: 'users', name: 'users', schema: { type: 'json', fields: [] }, consumer_group_initial_offset: 'latest', deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '1h' } },
          ],
        },
        join: {
          type: 'temporal',
          enabled: true,
          id: 'my-join',
          sources: [
            { source_id: 'orders', join_key: 'customer_id', time_window: '30s', orientation: 'left' },
            { source_id: 'users', join_key: 'user_id', time_window: '30s', orientation: 'right' },
          ],
        } as any,
        sink: {
          type: 'clickhouse',
          host: 'ch',
          port: '9000',
          http_port: '8123',
          database: 'default',
          table: 'joined',
          secure: false,
          table_mapping: [
            { source_id: 'orders', field_name: 'order_id', column_name: 'order_id', column_type: 'String' },
            { source_id: 'users', field_name: 'user_name', column_name: 'user_name', column_type: 'String' },
          ],
          max_batch_size: 1000,
          max_delay_time: '1s',
          skip_certificate_verification: false,
        } as any,
      }

      const result = adapter.generate(internal)

      expect(result.join.enabled).toBe(true)
      expect(result.join.left_source).toEqual({ source_id: 'orders', key: 'customer_id', time_window: '30s' })
      expect(result.join.right_source).toEqual({ source_id: 'users', key: 'user_id', time_window: '30s' })
      expect(result.join.output_fields).toEqual([
        { source_id: 'orders', name: 'order_id', output_name: 'order_id' },
        { source_id: 'users', name: 'user_name', output_name: 'user_name' },
      ])
      expect(result.join.sources).toBeUndefined()
    })

    it('generates otlp sources[] without connection_params', () => {
      const internal: InternalPipelineConfig = {
        pipeline_id: 'pipeline-otlp',
        name: 'OTLP',
        source: { type: 'otlp.traces', id: 'traces' } as any,
        join: { type: 'temporal', enabled: false, sources: [] },
        sink: {
          type: 'clickhouse',
          host: 'ch',
          port: '9000',
          http_port: '8123',
          database: 'default',
          table: 'traces',
          secure: false,
          table_mapping: [],
          max_batch_size: 1000,
          max_delay_time: '1s',
          skip_certificate_verification: false,
        } as any,
      }

      const result = adapter.generate(internal)
      expect(result.sources).toHaveLength(1)
      expect(result.sources[0]).toEqual({ type: 'otlp.traces', source_id: 'traces' })
      expect(result.join).toBeUndefined()
    })

    it('generates resources.sources[] from pipeline_resources.ingestor', () => {
      const internal: InternalPipelineConfig = {
        ...singleSourceInternal,
        pipeline_resources: {
          nats: { stream: { maxAge: '24h' } },
          ingestor: { base: { replicas: 2, requests: { cpu: '100m', memory: '256Mi' } } },
          transform: { replicas: 1, storage: { size: '1Gi' } },
          sink: { replicas: 1 },
        },
      }

      const result = adapter.generate(internal)
      expect(result.resources.sources).toHaveLength(1)
      expect(result.resources.sources[0]).toMatchObject({ source_id: 'orders', replicas: 2 })
      expect(result.resources.transform).toHaveLength(1)
      expect(result.resources.transform[0]).toMatchObject({ source_id: 'orders', storage: { size: '1Gi' } })
      expect(result.resources.nats).toEqual({ stream: { maxAge: '24h' } })
    })

    it('preserves engine and order_by in generate output for create-table flow', () => {
      const internal: InternalPipelineConfig = {
        ...singleSourceInternal,
        sink: {
          ...(singleSourceInternal.sink as any),
          engine: 'MergeTree',
          order_by: 'order_id',
        } as any,
      }

      const result = adapter.generate(internal)
      expect(result.sink.engine).toBe('MergeTree')
      expect(result.sink.order_by).toBe('order_id')
    })
  })

  // ── round-trip ────────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('hydrate → generate preserves shape for kafka single source with dedup + filter', () => {
      const internal = adapter.hydrate(kafkaSingleSourceConfig)
      const back = adapter.generate(internal)

      expect(back.version).toBe('v3')
      expect(back.sources[0].source_id).toBe('orders')
      expect(back.sources[0].schema_fields).toHaveLength(2)
      expect(back.transforms.find((t: any) => t.type === 'dedup').config.key).toBe('order_id')
      expect(back.transforms.find((t: any) => t.type === 'filter').config.expression).toBe('amount > 100')
      expect(back.sink.connection_params.host).toBe('ch-host')
      expect(back.sink.mapping).toHaveLength(2)
      expect(back.join).toBeUndefined()
    })
  })

  // ── factory ───────────────────────────────────────────────────────────────────

  describe('factory', () => {
    it('getPipelineAdapter returns V3 adapter for "v3" and "3"', () => {
      expect(getPipelineAdapter('v3').version).toBe(PipelineVersion.V3)
      expect(getPipelineAdapter('3').version).toBe(PipelineVersion.V3)
    })
  })
})
