import { Pipeline } from '../types'

// Mock data for pipelines (shared with parent route)
export const mockPipelines: Pipeline[] = [
  {
    id: 'pipeline-001',
    name: 'User Events Pipeline',
    status: 'active',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T14:45:00Z',
    config: {
      kafka: {
        topics: ['user-events', 'user-actions'],
        consumer_group: 'user-events-consumer',
      },
      clickhouse: {
        database: 'analytics',
        table: 'user_events',
      },
      operations: ['deduplication', 'transformation'],
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
    name: 'System Logs Pipeline',
    status: 'pausing',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    config: {
      kafka: {
        topics: ['system-logs', 'error-logs'],
        consumer_group: 'logs-consumer',
      },
      clickhouse: {
        database: 'monitoring',
        table: 'system_logs',
      },
      operations: ['deduplication'],
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
    name: 'Order Processing Pipeline',
    status: 'paused',
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-15T12:20:00Z',
    config: {
      kafka: {
        topics: ['orders', 'order-updates'],
        consumer_group: 'order-consumer',
      },
      clickhouse: {
        database: 'ecommerce',
        table: 'orders',
      },
      operations: ['deduplication', 'joining'],
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
    name: 'System Logs Pipeline',
    status: 'deleting',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    config: {
      kafka: {
        topics: ['system-logs', 'error-logs'],
        consumer_group: 'logs-consumer',
      },
      clickhouse: {
        database: 'monitoring',
        table: 'system_logs',
      },
      operations: ['deduplication'],
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
    name: 'System Logs Pipeline',
    status: 'deleted',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    config: {
      kafka: {
        topics: ['system-logs', 'error-logs'],
        consumer_group: 'logs-consumer',
      },
      clickhouse: {
        database: 'monitoring',
        table: 'system_logs',
      },
      operations: ['deduplication'],
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
    id: 'pipeline-006',
    name: 'System Logs Pipeline',
    status: 'error',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    config: {
      kafka: {
        topics: ['system-logs', 'error-logs'],
        consumer_group: 'logs-consumer',
      },
      clickhouse: {
        database: 'monitoring',
        table: 'system_logs',
      },
      operations: ['deduplication'],
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
    id: 'pipeline-007',
    name: 'System Logs Pipeline',
    status: 'terminated',
    created_at: '2024-01-12T16:45:00Z',
    updated_at: '2024-01-15T13:10:00Z',
    config: {
      kafka: {
        topics: ['system-logs', 'error-logs'],
        consumer_group: 'logs-consumer',
      },
      clickhouse: {
        database: 'monitoring',
        table: 'system_logs',
      },
      operations: ['deduplication'],
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
