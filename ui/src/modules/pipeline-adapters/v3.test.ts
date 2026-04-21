import { describe, it, expect } from 'vitest'
import { V3PipelineAdapter } from './v3'
import { InternalPipelineConfig } from '@/src/types/pipeline'
import { getPipelineAdapter } from './factory'
import { PipelineVersion } from '@/src/config/pipeline-versions'

describe('V3PipelineAdapter', () => {
  const adapter = new V3PipelineAdapter()

  describe('hydrate', () => {
    it('converts V3 source topics: schema_fields -> schema.fields, deduplication.key -> id_field', () => {
      const v3Config = {
        version: 'v3',
        pipeline_id: 'pipeline-transform',
        name: 'Test Pipeline',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: ['broker0'], protocol: 'SASL_PLAINTEXT', mechanism: 'PLAIN' },
          topics: [
            {
              id: 'orders',
              name: 'orders',
              consumer_group_initial_offset: 'latest',
              replicas: 1,
              deduplication: { enabled: true, key: 'order_id', time_window: '1h' },
              schema_version: '1',
              schema_fields: [
                { name: 'order_id', type: 'string' },
                { name: 'customer_id', type: 'string' },
                { name: 'amount', type: 'int' },
              ],
            },
          ],
        },
        join: { enabled: false },
        filter: { enabled: false },
        stateless_transformation: { enabled: false },
        sink: {
          type: 'clickhouse',
          connection_params: {
            host: 'clickhouse-host',
            port: '9000',
            http_port: '8123',
            database: 'default',
            username: '',
            password: '',
            secure: false,
          },
          table: 'orders',
          max_batch_size: 1000,
          max_delay_time: '1s',
          source_id: 'orders',
          mapping: [
            { name: 'order_id', column_name: 'order_id', column_type: 'String' },
            { name: 'amount', column_name: 'amount', column_type: 'Int32' },
          ],
        },
      }

      const result = adapter.hydrate(v3Config)

      expect(result.version).toBe('v3')
      const topic = result.source.topics[0]
      expect(topic.schema).toEqual({
        type: 'json',
        fields: [
          { name: 'order_id', type: 'string' },
          { name: 'customer_id', type: 'string' },
          { name: 'amount', type: 'int' },
        ],
      })
      expect(topic.deduplication).toMatchObject({
        enabled: true,
        id_field: 'order_id',
        id_field_type: 'string',
        time_window: '1h',
      })
      expect(result.sink.host).toBe('clickhouse-host')
      expect(result.sink.port).toBe('9000')
      expect(result.sink.http_port).toBe('8123')
      expect(result.sink.database).toBe('default')
      expect(result.sink.table_mapping).toEqual([
        { source_id: 'orders', field_name: 'order_id', column_name: 'order_id', column_type: 'String' },
        { source_id: 'orders', field_name: 'amount', column_name: 'amount', column_type: 'Int32' },
      ])
      expect(result.sink.connection_params).toBeUndefined()
      expect(result.sink.mapping).toBeUndefined()
    })

    it('converts V3 join: sources[].key -> join_key', () => {
      const v3Config = {
        version: 'v3',
        pipeline_id: 'pipeline-join',
        name: 'Join Pipeline',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [] },
          topics: [
            { id: 'orders', name: 'orders', schema_fields: [{ name: 'order_id', type: 'string' }], deduplication: { enabled: false } },
            { id: 'users', name: 'users', schema_fields: [{ name: 'user_id', type: 'string' }], deduplication: { enabled: false } },
          ],
        },
        join: {
          enabled: true,
          type: 'temporal',
          id: 'my-join',
          sources: [
            { source_id: 'orders', key: 'customer_id', time_window: '30s', orientation: 'left' },
            { source_id: 'users', key: 'user_id', time_window: '30s', orientation: 'right' },
          ],
          fields: [
            { source_id: 'orders', name: 'order_id' },
            { source_id: 'users', name: 'user_name' },
          ],
        },
        filter: { enabled: false },
        stateless_transformation: { enabled: false },
        sink: {
          type: 'clickhouse',
          connection_params: { host: 'ch', port: '9000', http_port: '8123', database: 'default', secure: false },
          table: 't',
          source_id: 'my-join',
          mapping: [],
        },
      }

      const result = adapter.hydrate(v3Config)

      expect(result.join.enabled).toBe(true)
      expect(result.join.sources[0]).toMatchObject({ source_id: 'orders', join_key: 'customer_id', time_window: '30s', orientation: 'left' })
      expect(result.join.sources[1]).toMatchObject({ source_id: 'users', join_key: 'user_id', time_window: '30s', orientation: 'right' })
      expect(result.join.sources[0].key).toBeUndefined()
      expect(result.join.sources[1].key).toBeUndefined()
    })

    it('converts V3 stateless_transformation to transformation with fields', () => {
      const v3Config = {
        version: 'v3',
        pipeline_id: 'pipeline-transform',
        name: 'Transform Pipeline',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [] },
          topics: [
            { id: 'orders', name: 'orders', schema_fields: [{ name: 'amount', type: 'int' }], deduplication: { enabled: false } },
          ],
        },
        join: { enabled: false },
        filter: { enabled: true, expression: 'amount > 100' },
        stateless_transformation: {
          enabled: true,
          id: 'my-transform',
          type: 'expr_lang_transform',
          source_id: 'orders',
          config: {
            transform: [
              { expression: 'int(amount) % 2 == 0', output_name: 'is_even_amount', output_type: 'bool' },
              { expression: 'amount', output_name: 'amount', output_type: 'int' },
            ],
          },
        },
        sink: {
          type: 'clickhouse',
          connection_params: { host: 'ch', port: '9000', http_port: '8123', database: 'default', secure: false },
          table: 'orders',
          source_id: 'my-transform',
          mapping: [
            { name: 'is_even_amount', column_name: 'is_even_amount', column_type: 'Bool' },
            { name: 'amount', column_name: 'amount', column_type: 'Int32' },
          ],
        },
      }

      const result = adapter.hydrate(v3Config)

      expect(result.stateless_transformation).toBeUndefined()
      expect(result.transformation?.enabled).toBe(true)
      expect(result.transformation?.fields).toHaveLength(2)
      expect(result.transformation?.fields?.[0]).toMatchObject({
        type: 'computed',
        outputFieldName: 'is_even_amount',
        outputFieldType: 'bool',
      })
      expect(result.transformation?.fields?.[1]).toMatchObject({
        type: 'passthrough',
        outputFieldName: 'amount',
        outputFieldType: 'int',
        sourceField: 'amount',
      })
    })
  })

  describe('generate', () => {
    it('outputs V3 sink: connection_params, mapping, source_id', () => {
      const internalConfig: InternalPipelineConfig = {
        pipeline_id: 'pipeline-1',
        name: 'Test',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [], protocol: 'PLAINTEXT', mechanism: 'NO_AUTH' },
          topics: [
            {
              id: 'orders',
              name: 'orders',
              schema: { type: 'json', fields: [{ name: 'order_id', type: 'string' }] },
              consumer_group_initial_offset: 'latest',
              deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '1h' },
            },
          ],
        },
        join: { type: '', enabled: false, sources: [] },
        sink: {
          type: 'clickhouse',
          host: 'clickhouse-host',
          port: '9000',
          http_port: '8123',
          database: 'default',
          table: 'orders',
          secure: false,
          table_mapping: [
            { source_id: 'orders', field_name: 'order_id', column_name: 'order_id', column_type: 'String' },
          ],
          max_batch_size: 1000,
          max_delay_time: '1s',
          skip_certificate_verification: false,
        } as any,
      }

      const result = adapter.generate(internalConfig)

      expect(result.version).toBe('v3')
      expect(result.sink.connection_params).toMatchObject({
        host: 'clickhouse-host',
        port: '9000',
        http_port: '8123',
        database: 'default',
        username: '',
        password: '',
        secure: false,
      })
      expect(result.sink.source_id).toBe('orders')
      expect(result.sink.mapping).toEqual([
        { name: 'order_id', column_name: 'order_id', column_type: 'String' },
      ])
      expect(result.sink.table_mapping).toBeUndefined()
      expect(result.sink.host).toBeUndefined()
    })

    it('preserves engine and order_by in generate output for create-table flow', () => {
      const internalConfig: InternalPipelineConfig = {
        pipeline_id: 'pipeline-1',
        name: 'Test',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [], protocol: 'PLAINTEXT', mechanism: 'NO_AUTH' },
          topics: [
            {
              id: 'orders',
              name: 'orders',
              schema: { type: 'json', fields: [{ name: 'order_id', type: 'string' }] },
              consumer_group_initial_offset: 'latest',
              deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '1h' },
            },
          ],
        },
        join: { type: '', enabled: false, sources: [] },
        sink: {
          type: 'clickhouse',
          host: 'clickhouse-host',
          port: '9000',
          http_port: '8123',
          database: 'default',
          table: 'new_orders',
          engine: 'MergeTree',
          order_by: 'order_id',
          secure: false,
          table_mapping: [
            { source_id: 'orders', field_name: 'order_id', column_name: 'order_id', column_type: 'String' },
          ],
          max_batch_size: 1000,
          max_delay_time: '1s',
          skip_certificate_verification: false,
        } as any,
      }

      const result = adapter.generate(internalConfig)

      // engine and order_by must survive generate() so the UI API route can
      // detect the create-table flow and create the table before stripping them.
      expect(result.sink.engine).toBe('MergeTree')
      expect(result.sink.order_by).toBe('order_id')
    })

    it('outputs V3 source topics: schema_fields, deduplication.key', () => {
      const internalConfig: InternalPipelineConfig = {
        pipeline_id: 'pipeline-1',
        name: 'Test',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [] },
          topics: [
            {
              id: 'orders',
              name: 'orders',
              schema: { type: 'json', fields: [{ name: 'order_id', type: 'string' }, { name: 'amount', type: 'int' }] },
              consumer_group_initial_offset: 'latest',
              deduplication: { enabled: true, id_field: 'order_id', id_field_type: 'string', time_window: '1h' },
            },
          ],
        },
        join: { type: '', enabled: false, sources: [] },
        sink: {
          type: 'clickhouse',
          host: 'ch',
          port: '9000',
          http_port: '8123',
          database: 'default',
          table: 't',
          secure: false,
          table_mapping: [],
          max_batch_size: 1000,
          max_delay_time: '1s',
          skip_certificate_verification: false,
        } as any,
      }

      const result = adapter.generate(internalConfig)

      const topic = result.source.topics[0]
      expect(topic.schema_fields).toEqual([
        { name: 'order_id', type: 'string' },
        { name: 'amount', type: 'int' },
      ])
      expect(topic.deduplication.key).toBe('order_id')
      expect(topic.deduplication.id_field).toBeUndefined()
      expect(topic.schema).toBeUndefined()
      expect(topic.schema_version).toBe('1')
      expect(topic.schema_registry).toEqual({ url: '', api_key: '', api_secret: '' })
    })

    it('outputs V3 join: key and fields from table_mapping', () => {
      const internalConfig: InternalPipelineConfig = {
        pipeline_id: 'pipeline-join',
        name: 'Join Pipeline',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [] },
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
        },
        sink: {
          type: 'clickhouse',
          host: 'ch',
          port: '9000',
          http_port: '8123',
          database: 'default',
          table: 't',
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

      const result = adapter.generate(internalConfig)

      expect(result.join.sources[0].key).toBe('customer_id')
      expect(result.join.sources[0].join_key).toBeUndefined()
      expect(result.join.sources[1].key).toBe('user_id')
      expect(result.join.fields).toEqual([
        { source_id: 'orders', name: 'order_id', output_name: 'order_id' },
        { source_id: 'users', name: 'user_name', output_name: 'user_name' },
      ])
      expect(result.sink.source_id).toBe('my-join')
    })

    it('outputs stateless_transformation with source_id when transformation enabled', () => {
      const internalConfig: InternalPipelineConfig = {
        pipeline_id: 'pipeline-1',
        name: 'Test',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [] },
          topics: [
            {
              id: 'orders',
              name: 'orders',
              schema: { type: 'json', fields: [{ name: 'amount', type: 'int' }] },
              consumer_group_initial_offset: 'latest',
              deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '1h' },
            },
          ],
        },
        join: { type: '', enabled: false, sources: [] },
        sink: {
          type: 'clickhouse',
          host: 'ch',
          port: '9000',
          http_port: '8123',
          database: 'default',
          table: 't',
          secure: false,
          table_mapping: [{ source_id: 'test-transform', field_name: 'amount', column_name: 'amount', column_type: 'Int32' }],
          max_batch_size: 1000,
          max_delay_time: '1s',
          skip_certificate_verification: false,
        } as any,
        transformation: {
          enabled: true,
          expression: '',
          fields: [
            { id: 'f1', type: 'passthrough', outputFieldName: 'amount', outputFieldType: 'int', sourceField: 'amount', sourceFieldType: 'int' },
          ],
        },
      } as InternalPipelineConfig

      const result = adapter.generate(internalConfig)

      expect(result.stateless_transformation).toMatchObject({
        id: 'test-transform',
        type: 'expr_lang_transform',
        enabled: true,
        source_id: 'orders',
      })
      expect(result.stateless_transformation?.config?.transform).toHaveLength(1)
      expect(result.transformation).toBeUndefined()
      expect(result.sink.source_id).toBe('test-transform')
    })
  })

  describe('round-trip', () => {
    it('hydrate then generate preserves V3 shape for transformation pipeline', () => {
      const v3Config = {
        version: 'v3',
        pipeline_id: 'pipeline-transform',
        name: 'Test Pipeline - Transform',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: ['broker0'] },
          topics: [
            {
              id: 'orders',
              name: 'orders',
              consumer_group_initial_offset: 'latest',
              replicas: 1,
              deduplication: { enabled: true, key: 'order_id', time_window: '1h' },
              schema_fields: [
                { name: 'order_id', type: 'string' },
                { name: 'amount', type: 'int' },
              ],
            },
          ],
        },
        join: { enabled: false },
        filter: { enabled: true, expression: 'amount > 100' },
        stateless_transformation: {
          enabled: true,
          id: 'my-transform',
          type: 'expr_lang_transform',
          source_id: 'orders',
          config: {
            transform: [
              { expression: 'order_id', output_name: 'order_id', output_type: 'string' },
              { expression: 'amount', output_name: 'amount', output_type: 'int' },
            ],
          },
        },
        sink: {
          type: 'clickhouse',
          connection_params: { host: 'clickhouse-host', port: '9000', http_port: '8123', database: 'default', username: '', password: '', secure: false },
          table: 'orders',
          max_batch_size: 1000,
          max_delay_time: '1s',
          source_id: 'my-transform',
          mapping: [
            { name: 'order_id', column_name: 'order_id', column_type: 'String' },
            { name: 'amount', column_name: 'amount', column_type: 'Int32' },
          ],
        },
      }

      const internal = adapter.hydrate(v3Config)
      const backToV3 = adapter.generate(internal)

      expect(backToV3.version).toBe('v3')
      expect(backToV3.sink.connection_params).toBeDefined()
      expect(backToV3.sink.connection_params.host).toBe('clickhouse-host')
      expect(backToV3.sink.mapping).toHaveLength(2)
      expect(backToV3.sink.source_id).toBe('my-transform')
      expect(backToV3.source.topics[0].schema_fields).toHaveLength(2)
      expect(backToV3.source.topics[0].deduplication.key).toBe('order_id')
      expect(backToV3.stateless_transformation?.source_id).toBe('orders')
    })
  })

  describe('factory', () => {
    it('getPipelineAdapter returns V3 adapter for "v3" and "3"', () => {
      expect(getPipelineAdapter('v3').version).toBe(PipelineVersion.V3)
      expect(getPipelineAdapter('3').version).toBe(PipelineVersion.V3)
    })
  })
})
