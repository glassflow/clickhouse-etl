import { describe, it, expect } from 'vitest'
import { V2PipelineAdapter } from './v2'
import { InternalPipelineConfig } from '@/src/types/pipeline'

describe('V2PipelineAdapter', () => {
  const adapter = new V2PipelineAdapter()

  describe('generate', () => {
    it('includes raw expression in stateless_transformation when transformation field has rawExpression and expressionMode', () => {
      const internalConfig: InternalPipelineConfig = {
        pipeline_id: 'test-61mnag30',
        name: 'test',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: {
            brokers: [],
            protocol: 'PLAINTEXT',
            mechanism: 'NO_AUTH',
          },
          topics: [
            {
              name: 'transactions',
              id: 'transactions',
              schema: { type: 'json', fields: [] },
              consumer_group_initial_offset: 'latest',
              deduplication: {
                enabled: false,
                id_field: '',
                id_field_type: 'string',
                time_window: '1h',
              },
            },
          ],
        },
        join: { type: '', enabled: false, sources: [] },
        sink: {
          type: 'clickhouse',
          host: '',
          httpPort: '8123',
          database: 'default',
          table: 'test',
          secure: false,
          table_mapping: [],
          max_batch_size: 1000,
          max_delay_time: '1m',
          skip_certificate_verification: false,
        },
        transformation: {
          enabled: true,
          expression: '',
          fields: [
            {
              id: 'f1',
              type: 'passthrough',
              outputFieldName: 'transaction_id',
              outputFieldType: 'uint8',
              sourceField: 'transaction_id',
              sourceFieldType: 'string',
            },
            {
              id: 'f2',
              type: 'computed',
              outputFieldName: 'transaction_amount',
              outputFieldType: 'int',
              expressionMode: 'raw',
              rawExpression: 'toInt(transaction_amount)',
            },
          ],
        },
      }

      const result = adapter.generate(internalConfig)

      const transform = result.stateless_transformation?.config?.transform ?? []
      const amountEntry = transform.find((t: any) => t.output_name === 'transaction_amount')
      expect(amountEntry).toBeDefined()
      expect(amountEntry.expression).toBe('toInt(transaction_amount)')
      expect(amountEntry.output_type).toBe('int')
    })

    it('when transform enabled and dedup enabled, schema has transform outputs plus minimal topic field (dedup key) for ingestor', () => {
      const internalConfig: InternalPipelineConfig = {
        pipeline_id: 'test-pqgggcdm',
        name: 'test',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [], protocol: 'PLAINTEXT', mechanism: 'NO_AUTH' },
          topics: [
            {
              name: 'test',
              id: 'test',
              schema: {
                type: 'json',
                fields: [
                  { name: 'event_id', type: 'string' },
                  { name: 'name', type: 'string' },
                  { name: 'amount', type: 'string' },
                  { name: 'created_at', type: 'string' },
                ],
              },
              consumer_group_initial_offset: 'latest',
              deduplication: { enabled: true, id_field: 'event_id', id_field_type: 'string', time_window: '1h' },
            },
          ],
        },
        join: { type: '', enabled: false, sources: [] },
        sink: {
          type: 'clickhouse',
          host: '',
          httpPort: '8123',
          database: 'default',
          table: 'test',
          secure: false,
          table_mapping: [
            { source_id: 'test', field_name: 'event_id', column_name: 'event_id', column_type: 'String' },
            { source_id: 'test', field_name: 'name', column_name: 'fullname', column_type: 'String' },
            { source_id: 'test-transform', field_name: 'filter', column_name: 'amount', column_type: 'Int64' },
          ],
          max_batch_size: 1000,
          max_delay_time: '1m',
          skip_certificate_verification: false,
        },
        transformation: {
          enabled: true,
          expression: '',
          fields: [
            { id: 'f1', type: 'passthrough', outputFieldName: 'event_id', outputFieldType: 'string', sourceField: 'event_id', sourceFieldType: 'string' },
            { id: 'f2', type: 'passthrough', outputFieldName: 'name', outputFieldType: 'string', sourceField: 'name', sourceFieldType: 'string' },
            { id: 'f3', type: 'passthrough', outputFieldName: 'amount', outputFieldType: 'uint8', sourceField: 'amount', sourceFieldType: 'string' },
            { id: 'f4', type: 'passthrough', outputFieldName: 'created_at', outputFieldType: 'string', sourceField: 'created_at', sourceFieldType: 'string' },
            { id: 'f5', type: 'computed', outputFieldName: 'filter', outputFieldType: 'int', expressionMode: 'raw', rawExpression: 'toInt(event_id) % 2 == 0' },
          ],
        },
      }

      const result = adapter.generate(internalConfig)
      const fields = result.schema?.fields ?? []

      const byKey = (f: { source_id: string; name: string }) => `${f.source_id}:${f.name}`
      expect(fields.map(byKey)).toHaveLength(new Set(fields.map(byKey)).size)

      // Effective schema = all transform outputs (source_id = test-transform)
      const transformFields = fields.filter((f: any) => f.source_id === 'test-transform')
      expect(transformFields.map((f: any) => f.name)).toEqual(['event_id', 'name', 'amount', 'created_at', 'filter'])
      expect(transformFields.find((f: any) => f.name === 'event_id')).toMatchObject({ column_name: 'event_id', column_type: 'String' })
      expect(transformFields.find((f: any) => f.name === 'name')).toMatchObject({ column_name: 'fullname', column_type: 'String' })
      expect(transformFields.find((f: any) => f.name === 'filter')).toMatchObject({ column_name: 'amount', column_type: 'Int64' })

      // Dedup enabled: minimal topic field (dedup key) so ingestor can validate
      const topicFields = fields.filter((f: any) => f.source_id === 'test')
      expect(topicFields.map((f: any) => f.name)).toEqual(['event_id'])
      expect(topicFields[0]).toMatchObject({ name: 'event_id', type: 'string', column_name: 'event_id', column_type: 'String' })
    })

    it('when transform enabled and no dedup/filter/join, schema has only transform outputs (no topic fields)', () => {
      const internalConfig: InternalPipelineConfig = {
        pipeline_id: 'test-zbvjebbw',
        name: 'test',
        source: {
          type: 'kafka',
          provider: 'custom',
          connection_params: { brokers: [], protocol: 'PLAINTEXT', mechanism: 'NO_AUTH' },
          topics: [
            {
              name: 'transactions',
              id: 'transactions',
              schema: {
                type: 'json',
                fields: [
                  { name: 'transaction_id', type: 'uint16' },
                  { name: 'transaction_amount', type: 'float32' },
                ],
              },
              consumer_group_initial_offset: 'latest',
              deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '1h' },
            },
          ],
        },
        join: { type: '', enabled: false, sources: [] },
        sink: {
          type: 'clickhouse',
          host: '',
          httpPort: '8123',
          database: 'default',
          table: 'test',
          secure: false,
          table_mapping: [
            { source_id: 'transactions', field_name: 'transaction_amount', column_name: 'amount', column_type: 'Int64' },
          ],
          max_batch_size: 1000,
          max_delay_time: '1m',
          skip_certificate_verification: false,
        },
        transformation: {
          enabled: true,
          expression: '',
          fields: [
            { id: 'f1', type: 'passthrough', outputFieldName: 'transaction_id', outputFieldType: 'uint16', sourceField: 'transaction_id', sourceFieldType: 'string' },
            { id: 'f2', type: 'computed', outputFieldName: 'transaction_amount', outputFieldType: 'int64', expressionMode: 'raw', rawExpression: 'toInt(transaction_amount) * 2' },
          ],
        },
      }

      const result = adapter.generate(internalConfig)
      const fields = result.schema?.fields ?? []

      // No topic in schema when no dedup/filter/join
      const topicFields = fields.filter((f: any) => f.source_id === 'transactions')
      expect(topicFields).toHaveLength(0)

      // Only transform outputs; transaction_amount has column mapping (from table_mapping by topic fallback)
      const transformFields = fields.filter((f: any) => f.source_id === 'test-transform')
      expect(transformFields.map((f: any) => f.name)).toEqual(['transaction_id', 'transaction_amount'])
      const transformAmount = transformFields.find((f: any) => f.name === 'transaction_amount')
      expect(transformAmount).toMatchObject({ column_name: 'amount', column_type: 'Int64' })
    })
  })
})
