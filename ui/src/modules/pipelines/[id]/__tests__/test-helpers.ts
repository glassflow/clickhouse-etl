import type { Pipeline } from '@/src/types/pipeline'

/**
 * Creates a minimal valid Pipeline for unit tests.
 * Satisfies the required shape used by PipelineDetailsModule and related components.
 */
export function createMockPipeline(overrides: Partial<Pipeline> & Record<string, unknown> = {}): Pipeline {
  return {
    pipeline_id: 'test-pipeline-id',
    name: 'Test Pipeline',
    status: 'stopped',
    source: {
      type: 'kafka',
      provider: 'kafka',
      connection_params: {
        brokers: ['localhost:9092'],
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
      },
      topics: [
        {
          name: 'test-topic',
          id: 'topic-1',
          schema: { type: 'json', fields: [] },
          consumer_group_initial_offset: 'earliest',
          deduplication: {
            enabled: false,
            id_field: '',
            id_field_type: 'string',
            time_window: '1',
          },
        },
      ],
    },
    join: {
      type: 'inner',
      enabled: false,
      sources: [],
    },
    sink: {
      type: 'clickhouse',
      host: 'localhost',
      httpPort: '8123',
      database: 'default',
      table: 'test_table',
      secure: false,
      table_mapping: [],
      max_batch_size: 1000,
      max_delay_time: '1s',
      skip_certificate_verification: false,
    },
    ...overrides,
  } as Pipeline
}
