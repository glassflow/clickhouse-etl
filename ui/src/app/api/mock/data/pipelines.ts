// clickhouse-etl/ui/src/app/api/mock/data/pipelines.ts

import type { Pipeline, ListPipelineConfig } from '@/src/types/pipeline'

// Utility function to find a pipeline by ID
export const findPipeline = (id: string): Pipeline | undefined => {
  return mockPipelines.find((p) => p.id === id)
}

// Utility function to convert Pipeline to ListPipelineConfig
const pipelineToListConfig = (pipeline: Pipeline): ListPipelineConfig => ({
  pipeline_id: pipeline.id,
  name: pipeline.name,
  transformation_type: (pipeline.transformationName || 'Ingest Only') as
    | 'Join'
    | 'Join & Deduplication'
    | 'Deduplication'
    | 'Ingest Only',
  created_at: pipeline.created_at,
  state: pipeline.status,
})

// Function to synchronize list data from detailed data
export const syncPipelinesList = (): ListPipelineConfig[] => {
  return mockPipelines.map(pipelineToListConfig)
}

// Dynamic getter for pipeline list - always in sync with detailed data
export const getMockPipelinesList = (): ListPipelineConfig[] => {
  return syncPipelinesList()
}

export const mockPipelines: Pipeline[] = [
  {
    id: 'pipeline-001',
    name: 'Deduplication Pipeline',
    status: 'active',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T14:45:00Z',
    transformationName: 'Deduplication',
    source: {
      type: 'kafka',
      provider: 'local',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        // username: 'admin',
        // password: 'admin',
        // root_ca: '<base64 encoded ca>',
      },
      topics: [
        {
          consumer_group_initial_offset: 'earliest',
          name: 'transactions',
          schema: {
            type: 'json',
            fields: [
              { name: 'transaction_id', type: 'string' },
              { name: 'transaction_date', type: 'string' },
              { name: 'transaction_amount', type: 'number' },
              { name: 'transaction_type', type: 'string' },
              { name: 'transaction_description', type: 'string' },
              { name: 'merchant_name', type: 'string' },
              { name: 'category', type: 'string' },
              { name: 'account_balance', type: 'number' },
              { name: 'currency', type: 'string' },
              { name: 'location', type: 'string' },
            ],
          },
          deduplication: {
            enabled: true,
            id_field: 'transaction_id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
      ],
    },
    join: {
      enabled: false,
    },
    sink: {
      type: 'clickhouse',
      provider: 'aiven',
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      port: '12754',
      nativePort: '12753',
      database: 'vlad',
      username: 'avnadmin',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD,
      secure: true,
      max_batch_size: 1,
      max_delay_time: '10m',
      table: 'test_table',
      table_mapping: [
        {
          source_id: 'transactions',
          field_name: 'transaction_id',
          column_name: 'transaction_id',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_date',
          column_name: 'transaction_date',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_amount',
          column_name: 'transaction_amount',
          column_type: 'DateTime',
        },
      ],
    },
    stats: {
      events_processed: 15420,
      events_failed: 23,
      throughput_per_second: 150,
      last_event_processed: '2024-01-15T14:44:30Z',
    },
  },
  {
    id: 'pipeline-002',
    name: 'Deduplication & Join Pipeline',
    status: 'paused',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    transformationName: 'Deduplication & Join',
    source: {
      type: 'kafka',
      provider: 'aiven',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        // username: 'admin',
        // password: 'admin',
        // root_ca: '<base64 encoded ca>',
      },
      topics: [
        {
          consumer_group_initial_offset: 'earliest',
          name: 'transactions',
          schema: {
            type: 'json',
            fields: [
              { name: 'transaction_id', type: 'string' },
              { name: 'transaction_date', type: 'string' },
              { name: 'transaction_amount', type: 'number' },
              { name: 'transaction_type', type: 'string' },
              { name: 'transaction_description', type: 'string' },
              { name: 'merchant_name', type: 'string' },
              { name: 'category', type: 'string' },
              { name: 'account_balance', type: 'number' },
              { name: 'currency', type: 'string' },
              { name: 'location', type: 'string' },
            ],
          },
          deduplication: {
            enabled: true,
            id_field: 'transaction_id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
        {
          consumer_group_initial_offset: 'earliest',
          name: 'other_transactions',
          schema: {
            type: 'json',
            fields: [
              { name: 'transaction_id', type: 'string' },
              { name: 'transaction_date', type: 'string' },
              { name: 'transaction_amount', type: 'number' },
              { name: 'transaction_type', type: 'string' },
              { name: 'transaction_description', type: 'string' },
              { name: 'merchant_name', type: 'string' },
              { name: 'category', type: 'string' },
              { name: 'account_balance', type: 'number' },
              { name: 'currency', type: 'string' },
              { name: 'location', type: 'string' },
            ],
          },
          deduplication: {
            enabled: true,
            id_field: 'transaction_id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
      ],
    },
    join: {
      enabled: true,
      type: 'temporal',
      sources: [
        {
          source_id: 'transactions',
          join_key: 'transaction_id',
          time_window: '1h',
          orientation: 'left',
        },
        {
          source_id: 'other_transactions',
          join_key: 'transaction_id',
          time_window: '1h',
          orientation: 'right',
        },
      ],
    },
    sink: {
      type: 'clickhouse',
      provider: 'aiven',
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      port: '12754',
      nativePort: '12753',
      database: 'vlad',
      username: 'avnadmin',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD,
      secure: true,
      max_batch_size: 1,
      max_delay_time: '10m',
      table: 'test_table',
      table_mapping: [
        {
          source_id: 'transactions',
          field_name: 'transaction_id',
          column_name: 'transaction_id',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_date',
          column_name: 'transaction_date',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_amount',
          column_name: 'transaction_amount',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_type',
          column_name: 'transaction_type',
          column_type: 'DateTime',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_description',
          column_name: 'transaction_description',
          column_type: 'DateTime',
        },
        {
          source_id: 'transactions',
          field_name: 'merchant_name',
          column_name: 'merchant_name',
          column_type: 'UUID',
        },
      ],
    },
    stats: {
      events_processed: 4560,
      events_failed: 156,
      throughput_per_second: 0,
      last_event_processed: '2024-01-15T13:09:20Z',
    },
    error: 'Kafka connection timeout',
  },
  {
    id: 'pipeline-003',
    name: 'Ingest Only Pipeline',
    status: 'active',
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-15T12:20:00Z',
    transformationName: 'Ingest Only',
    source: {
      type: 'kafka',
      provider: 'aiven',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        // username: 'admin',
        // password: 'admin',
        // root_ca: '<base64 encoded ca>',
      },
      topics: [
        {
          consumer_group_initial_offset: 'earliest',
          name: 'transactions',
          schema: {
            type: 'json',
            fields: [
              { name: 'transaction_id', type: 'string' },
              { name: 'transaction_date', type: 'string' },
              { name: 'transaction_amount', type: 'number' },
              { name: 'transaction_type', type: 'string' },
              { name: 'transaction_description', type: 'string' },
              { name: 'merchant_name', type: 'string' },
              { name: 'category', type: 'string' },
              { name: 'account_balance', type: 'number' },
              { name: 'currency', type: 'string' },
              { name: 'location', type: 'string' },
            ],
          },
          deduplication: {
            enabled: false,
            id_field: 'transaction_id',
            id_field_type: 'string',
            time_window: '0h',
          },
        },
      ],
    },
    join: {
      enabled: false,
    },
    sink: {
      type: 'clickhouse',
      provider: 'aiven',
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      port: '12754',
      nativePort: '12753',
      database: 'vlad',
      username: 'avnadmin',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD,
      secure: true,
      max_batch_size: 100,
      max_delay_time: '5m',
      table: 'orders',
      table_mapping: [
        {
          source_id: 'transactions',
          field_name: 'transaction_id',
          column_name: 'transaction_id',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_date',
          column_name: 'transaction_date',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_amount',
          column_name: 'transaction_amount',
          column_type: 'Decimal(10,2)',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_type',
          column_name: 'transaction_type',
          column_type: 'DateTime',
        },
      ],
    },
    stats: {
      events_processed: 8920,
      events_failed: 5,
      throughput_per_second: 85,
      last_event_processed: '2024-01-15T12:19:45Z',
    },
  },
  {
    id: 'pipeline-004',
    name: 'Join Pipeline',
    status: 'paused',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    transformationName: 'Join',
    source: {
      type: 'kafka',
      provider: 'aiven',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        // username: 'admin',
        // password: 'admin',
        // root_ca: '<base64 encoded ca>',
      },
      topics: [
        {
          consumer_group_initial_offset: 'earliest',
          name: 'transactions',
          schema: {
            type: 'json',
            fields: [
              { name: 'transaction_id', type: 'string' },
              { name: 'transaction_date', type: 'string' },
              { name: 'transaction_amount', type: 'number' },
              { name: 'transaction_type', type: 'string' },
              { name: 'transaction_description', type: 'string' },
              { name: 'merchant_name', type: 'string' },
              { name: 'category', type: 'string' },
              { name: 'account_balance', type: 'number' },
              { name: 'currency', type: 'string' },
              { name: 'location', type: 'string' },
            ],
          },
          deduplication: {
            enabled: false,
            id_field: 'transaction_id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
        {
          consumer_group_initial_offset: 'earliest',
          name: 'transactions',
          schema: {
            type: 'json',
            fields: [
              { name: 'transaction_id', type: 'string' },
              { name: 'transaction_date', type: 'string' },
              { name: 'transaction_amount', type: 'number' },
              { name: 'transaction_type', type: 'string' },
              { name: 'transaction_description', type: 'string' },
              { name: 'merchant_name', type: 'string' },
              { name: 'category', type: 'string' },
              { name: 'account_balance', type: 'number' },
              { name: 'currency', type: 'string' },
              { name: 'location', type: 'string' },
            ],
          },
          deduplication: {
            enabled: false,
            id_field: 'transaction_id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
      ],
    },
    join: {
      enabled: true,
      type: 'temporal',
      sources: [
        {
          source_id: 'transactions',
          join_key: 'transaction_id',
          time_window: '1h',
          orientation: 'left',
        },
        {
          source_id: 'other_transactions',
          join_key: 'transaction_id',
          time_window: '1h',
          orientation: 'right',
        },
      ],
    },
    sink: {
      type: 'clickhouse',
      provider: 'aiven',
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      port: '12754',
      nativePort: '12753',
      database: 'vlad',
      username: 'avnadmin',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD,
      secure: true,
      max_batch_size: 1,
      max_delay_time: '10m',
      table: 'test_table',
      table_mapping: [
        {
          source_id: 'transactions',
          field_name: 'transaction_id',
          column_name: 'transaction_id',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_date',
          column_name: 'transaction_date',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_amount',
          column_name: 'transaction_amount',
          column_type: 'UUID',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_type',
          column_name: 'transaction_type',
          column_type: 'DateTime',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_description',
          column_name: 'transaction_description',
          column_type: 'DateTime',
        },
        {
          source_id: 'transactions',
          field_name: 'merchant_name',
          column_name: 'merchant_name',
          column_type: 'UUID',
        },
      ],
    },
    stats: {
      events_processed: 4560,
      events_failed: 156,
      throughput_per_second: 0,
      last_event_processed: '2024-01-15T13:09:20Z',
    },
    error: 'Kafka connection timeout',
  },
  {
    id: 'pipeline-005',
    name: 'Deduplication & Join Pipeline',
    status: 'active',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    transformationName: 'Deduplication & Join',
    source: {
      type: 'kafka',
      provider: 'aiven',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        // username: 'admin',
        // password: 'admin',
        // root_ca: '<base64 encoded ca>',
      },
      topics: [
        {
          consumer_group_initial_offset: 'earliest',
          name: 'test_topic_1',
          schema: {
            type: 'json',
            fields: [
              { name: 'id', type: 'string' },
              { name: 'name', type: 'string' },
            ],
          },
          deduplication: {
            enabled: true,
            id_field: 'id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
        {
          consumer_group_initial_offset: 'earliest',
          name: 'test_topic_2',
          schema: {
            type: 'json',
            fields: [
              { name: 'id', type: 'string' },
              { name: 'name', type: 'string' },
            ],
          },
          deduplication: {
            enabled: true,
            id_field: 'id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
      ],
    },
    join: {
      enabled: true,
      type: 'temporal',
      sources: [
        {
          source_id: 'test_topic_1',
          join_key: 'id',
          time_window: '1h',
          orientation: 'left',
        },
        {
          source_id: 'test_topic_2',
          join_key: 'id',
          time_window: '1h',
          orientation: 'right',
        },
      ],
    },
    sink: {
      type: 'clickhouse',
      provider: 'aiven',
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      port: '12754',
      nativePort: '12753',
      database: 'vlad',
      username: 'avnadmin',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD,
      secure: true,
      max_batch_size: 1,
      max_delay_time: '10m',
      table: 'test_table',
      table_mapping: [
        {
          source_id: 'test_topic_1',
          field_name: 'id',
          column_name: 'id',
          column_type: 'UUID',
        },
        {
          source_id: 'test_topic_1',
          field_name: 'name',
          column_name: 'name',
          column_type: 'UUID',
        },
        {
          source_id: 'test_topic_2',
          field_name: 'id',
          column_name: 'id',
          column_type: 'UUID',
        },
        {
          source_id: 'test_topic_2',
          field_name: 'name',
          column_name: 'name',
          column_type: 'DateTime',
        },
      ],
    },
    stats: {
      events_processed: 4560,
      events_failed: 156,
      throughput_per_second: 0,
      last_event_processed: '2024-01-15T13:09:20Z',
    },
    error: 'Kafka connection timeout',
  },
]
