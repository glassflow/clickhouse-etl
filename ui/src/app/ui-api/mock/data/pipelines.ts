// clickhouse-etl/ui/src/app/ui-api/mock/data/pipelines.ts

import type { Pipeline, ListPipelineConfig } from '@/src/types/pipeline'
import { detectTransformationType } from '@/src/types/pipeline'

// Backend response format (what the API returns)
type BackendPipeline = Omit<Pipeline, 'sink'> & {
  sink: Omit<Pipeline['sink'], 'httpPort' | 'nativePort'> & {
    http_port: string
    port: string
  }
}

// Utility function to find a pipeline by ID
export const findPipeline = (id: string): BackendPipeline | undefined => {
  return mockPipelines.find((p) => p.pipeline_id === id)
}

// Convert BackendPipeline to frontend Pipeline format for transformation detection
const backendToFrontendPipeline = (backendPipeline: BackendPipeline): Pipeline => ({
  ...backendPipeline,
  sink: {
    ...backendPipeline.sink,
    httpPort: backendPipeline.sink.http_port,
    nativePort: backendPipeline.sink.port,
  },
})

// Utility function to convert BackendPipeline to ListPipelineConfig
const pipelineToListConfig = (pipeline: BackendPipeline): ListPipelineConfig => ({
  pipeline_id: pipeline.pipeline_id,
  name: pipeline.name,
  transformation_type: detectTransformationType(backendToFrontendPipeline(pipeline)),
  created_at: pipeline.created_at || new Date().toISOString(),
  state: pipeline.state,
})

// Function to synchronize list data from detailed data
export const syncPipelinesList = (): ListPipelineConfig[] => {
  return mockPipelines.map(pipelineToListConfig)
}

// Dynamic getter for pipeline list - always in sync with detailed data
export const getMockPipelinesList = (): ListPipelineConfig[] => {
  return syncPipelinesList()
}

export const mockPipelines: BackendPipeline[] = [
  {
    pipeline_id: 'pipeline-001',
    name: 'Deduplication Pipeline',
    state: 'active',
    status: 'active',
    created_at: '2024-01-15T10:30:00Z',
    source: {
      type: 'kafka',
      provider: 'local',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        skip_auth: true,
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        // username: '',
        // password: '',
        // root_ca: '',
      },
      topics: [
        {
          name: 'transactions',
          id: 'transactions',
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
          consumer_group_initial_offset: 'earliest',
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
      type: 'temporal',
      enabled: false,
      sources: [],
    },
    sink: {
      type: 'clickhouse',
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      http_port: '12754',
      port: '12753',
      database: 'vlad',
      username: process.env.NEXT_PUBLIC_CLICKHOUSE_USERNAME || '',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD || '',
      secure: true,
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
          column_type: 'DateTime',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_amount',
          column_name: 'transaction_amount',
          column_type: 'Decimal(10,2)',
        },
      ],
      max_batch_size: 1000,
      max_delay_time: '60s',
      skip_certificate_verification: false,
    },
  },
  {
    pipeline_id: 'pipeline-002',
    name: 'Deduplication & Join Pipeline',
    state: 'paused',
    status: 'paused',
    created_at: '2024-01-12T16:45:00Z',
    source: {
      type: 'kafka',
      provider: 'local',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        skip_auth: true,
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        // username: 'admin',
        // password: 'admin',
        // root_ca: '',
      },
      topics: [
        {
          name: 'transactions',
          id: 'transactions',
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
          consumer_group_initial_offset: 'earliest',
          deduplication: {
            enabled: true,
            id_field: 'transaction_id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
        {
          name: 'other_transactions',
          id: 'other_transactions',
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
          consumer_group_initial_offset: 'earliest',
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
      type: 'temporal',
      enabled: true,
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
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      http_port: '12754',
      port: '12753',
      database: 'vlad',
      username: process.env.NEXT_PUBLIC_CLICKHOUSE_USERNAME || '',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD || '',
      secure: true,
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
          column_type: 'DateTime',
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
      max_batch_size: 1000,
      max_delay_time: '60s',
      skip_certificate_verification: false,
    },
  },
  {
    pipeline_id: 'pipeline-003',
    name: 'Ingest Only Pipeline',
    state: 'active',
    status: 'active',
    created_at: '2024-01-10T09:15:00Z',
    source: {
      type: 'kafka',
      provider: 'aiven',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        skip_auth: true,
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        username: 'mock_user',
        password: '',
        root_ca: '',
      },
      topics: [
        {
          name: 'transactions',
          id: 'topic-1',
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
          consumer_group_initial_offset: 'earliest',
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
      type: 'temporal',
      enabled: false,
      sources: [],
    },
    sink: {
      type: 'clickhouse',
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      http_port: '12754',
      port: '12753',
      database: 'vlad',
      username: process.env.NEXT_PUBLIC_CLICKHOUSE_USERNAME || '',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD || '',
      secure: true,
      table: 'transactions',
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
          column_type: 'DateTime',
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
          column_type: 'String',
        },
      ],
      max_batch_size: 100,
      max_delay_time: '5m',
      skip_certificate_verification: false,
    },
  },
  {
    pipeline_id: 'pipeline-004',
    name: 'Join Pipeline',
    state: 'paused',
    status: 'paused',
    created_at: '2024-01-12T16:45:00Z',
    source: {
      type: 'kafka',
      provider: 'local',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        skip_auth: true,
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        username: process.env.NEXT_PUBLIC_CLICKHOUSE_USERNAME || '',
        password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD || '',
        root_ca: '',
      },
      topics: [
        {
          name: 'transactions',
          id: 'transactions',
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
          consumer_group_initial_offset: 'earliest',
          deduplication: {
            enabled: false,
            id_field: 'transaction_id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
        {
          name: 'test_topic_1',
          id: 'test_topic_1',
          schema: {
            type: 'json',
            fields: [
              { name: 'id', type: 'string' },
              { name: 'name', type: 'string' },
            ],
          },
          consumer_group_initial_offset: 'earliest',
          deduplication: {
            enabled: false,
            id_field: 'id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
      ],
    },
    join: {
      type: 'temporal',
      enabled: true,
      sources: [
        {
          source_id: 'transactions',
          join_key: 'transaction_id',
          time_window: '1h',
          orientation: 'left',
        },
        {
          source_id: 'test_topic_1',
          join_key: 'id',
          time_window: '1h',
          orientation: 'right',
        },
      ],
    },
    sink: {
      type: 'clickhouse',
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      http_port: '12754',
      port: '12753',
      database: 'vlad',
      username: process.env.NEXT_PUBLIC_CLICKHOUSE_USERNAME || '',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD || '',
      table: 'test_table',
      secure: false,
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
          column_type: 'DateTime',
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
          column_type: 'String',
        },
        {
          source_id: 'transactions',
          field_name: 'transaction_description',
          column_name: 'transaction_description',
          column_type: 'String',
        },
        {
          source_id: 'transactions',
          field_name: 'merchant_name',
          column_name: 'merchant_name',
          column_type: 'String',
        },
      ],
      max_batch_size: 1000,
      max_delay_time: '60s',
      skip_certificate_verification: false,
    },
  },
  {
    pipeline_id: 'pipeline-005',
    name: 'Deduplication & Join Pipeline',
    state: 'active',
    status: 'active',
    created_at: '2024-01-12T16:45:00Z',
    source: {
      type: 'kafka',
      provider: 'local',
      connection_params: {
        brokers: ['localhost:9092,localhost:9093,localhost:9094'],
        skip_auth: true,
        protocol: 'PLAINTEXT',
        mechanism: 'NO_AUTH',
        username: 'mock_user',
        password: '',
        root_ca: '',
      },
      topics: [
        {
          name: 'test_topic_1',
          id: 'test_topic_1',
          schema: {
            type: 'json',
            fields: [
              { name: 'id', type: 'string' },
              { name: 'name', type: 'string' },
            ],
          },
          consumer_group_initial_offset: 'earliest',
          deduplication: {
            enabled: true,
            id_field: 'id',
            id_field_type: 'string',
            time_window: '12h',
          },
        },
        {
          name: 'test_topic_2',
          id: 'test_topic_2',
          schema: {
            type: 'json',
            fields: [
              { name: 'id', type: 'string' },
              { name: 'name', type: 'string' },
            ],
          },
          consumer_group_initial_offset: 'earliest',
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
      type: 'temporal',
      enabled: true,
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
      host: process.env.NEXT_PUBLIC_CLICKHOUSE_HOST || '',
      http_port: '12754',
      port: '12753',
      database: 'vlad',
      username: process.env.NEXT_PUBLIC_CLICKHOUSE_USERNAME || '',
      password: process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD || '',
      table: 'test_table',
      secure: true,
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
          column_type: 'String',
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
          column_type: 'String',
        },
      ],
      max_batch_size: 1000,
      max_delay_time: '60s',
      skip_certificate_verification: false,
    },
  },
]
