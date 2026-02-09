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
  })
})
