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

    it('schema has topic fields with source_id=topic and only derived transform outputs with source_id=transform (no duplication)', () => {
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

      const topicFields = fields.filter((f: any) => f.source_id === 'test')
      expect(topicFields.map((f: any) => f.name).sort()).toEqual(['amount', 'created_at', 'event_id', 'name'])
      expect(topicFields.find((f: any) => f.name === 'event_id')).toMatchObject({ column_name: 'event_id', column_type: 'String' })
      expect(topicFields.find((f: any) => f.name === 'name')).toMatchObject({ column_name: 'fullname', column_type: 'String' })
      expect(topicFields.find((f: any) => f.name === 'amount')).not.toHaveProperty('column_name')
      expect(topicFields.find((f: any) => f.name === 'created_at')).not.toHaveProperty('column_name')

      const transformFields = fields.filter((f: any) => f.source_id === 'test-transform')
      expect(transformFields.map((f: any) => f.name)).toEqual(['filter'])
      expect(transformFields[0]).toMatchObject({ name: 'filter', type: 'int', column_name: 'amount', column_type: 'Int64' })
    })

    it('derived transform output with same name as topic field gets column from topic mapping fallback; topic field has no column', () => {
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

      const topicAmount = fields.find((f: any) => f.source_id === 'transactions' && f.name === 'transaction_amount')
      expect(topicAmount).toBeDefined()
      expect(topicAmount).not.toHaveProperty('column_name')
      expect(topicAmount).not.toHaveProperty('column_type')

      const transformAmount = fields.find((f: any) => f.source_id === 'test-transform' && f.name === 'transaction_amount')
      expect(transformAmount).toBeDefined()
      expect(transformAmount).toMatchObject({ column_name: 'amount', column_type: 'Int64' })
    })
  })
})
