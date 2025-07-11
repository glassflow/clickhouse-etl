// Utility to handle mock vs real API switching
export const isMockMode = () => {
  return process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'
}

export const getApiUrl = (endpoint: string) => {
  if (isMockMode()) {
    return `/api/mock/${endpoint}`
  }
  return `/api/${endpoint}`
}

// Mock data generators for more realistic responses
export const generateMockPipeline = (id: string = `pipeline-${Date.now()}`) => ({
  id,
  name: `Mock Pipeline ${id}`,
  status: 'active' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  config: {
    kafka: {
      topics: ['mock-topic-1', 'mock-topic-2'],
      consumer_group: 'mock-consumer',
    },
    clickhouse: {
      database: 'mock_database',
      table: 'mock_table',
    },
    operations: ['deduplication'],
  },
  stats: {
    events_processed: Math.floor(Math.random() * 10000),
    events_failed: Math.floor(Math.random() * 100),
    throughput_per_second: Math.floor(Math.random() * 200),
    last_event_processed: new Date().toISOString(),
  },
})

export const generateMockSchema = (id: string = `schema-${Date.now()}`) => ({
  id,
  name: `Mock Schema ${id}`,
  version: '1.0.0',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
      data: { type: 'object' },
    },
    required: ['id', 'timestamp'],
  },
  mappings: {
    kafka_topic: 'mock-topic',
    clickhouse_table: 'mock_table',
    field_mappings: {
      id: 'event_id',
      timestamp: 'created_at',
      data: 'event_data',
    },
  },
})

export const generateMockConnection = (id: string = `conn-${Date.now()}`) => ({
  id,
  name: `Mock Connection ${id}`,
  type: 'kafka' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  config: {
    servers: ['mock-kafka:9092'],
    security_protocol: 'PLAINTEXT',
    auth_method: 'None',
  },
})

export const generateMockDLQStats = (pipelineId: string) => ({
  total_failed_events: Math.floor(Math.random() * 1000),
  failed_events_today: Math.floor(Math.random() * 50),
  last_failure: new Date().toISOString(),
  failure_rate: Math.random() * 5,
  top_error_types: [
    { error_type: 'Schema validation failed', count: Math.floor(Math.random() * 100) },
    { error_type: 'Connection timeout', count: Math.floor(Math.random() * 50) },
    { error_type: 'Data type mismatch', count: Math.floor(Math.random() * 25) },
  ],
})

export const generateMockDLQEvent = (id: string = `dlq-${Date.now()}`) => ({
  id,
  original_event: {
    user_id: `user-${Math.floor(Math.random() * 1000)}`,
    event_type: ['page_view', 'purchase', 'click'][Math.floor(Math.random() * 3)],
    timestamp: new Date().toISOString(),
    data: { value: Math.floor(Math.random() * 1000) },
  },
  error: 'Schema validation failed: missing required field',
  failed_at: new Date().toISOString(),
  retry_count: Math.floor(Math.random() * 5),
})

// Legacy functions for backward compatibility
export const generateMockKafkaEvent = (offset: number = 100) => ({
  id: `event-${offset}`,
  timestamp: new Date().toISOString(),
  data: {
    message: `Mock event ${offset}`,
    value: Math.floor(Math.random() * 1000),
    user_id: `user-${Math.floor(Math.random() * 100)}`,
    action: ['click', 'view', 'purchase'][Math.floor(Math.random() * 3)],
  },
  _metadata: {
    offset,
    partition: 0,
    topic: 'mock-topic-1',
    timestamp: Date.now(),
  },
})

export const generateMockKafkaTopics = () => [
  'user-events',
  'order-events',
  'analytics-events',
  'system-logs',
  'error-logs',
]

export const generateMockClickhouseDatabases = () => ['default', 'system', 'analytics', 'user_data', 'logs']

export const generateMockClickhouseTables = (database: string) => [
  `${database}_events`,
  `${database}_users`,
  `${database}_orders`,
  `${database}_logs`,
]

export const generateMockClickhouseSchema = () => [
  { name: 'id', type: 'UInt32', default: null },
  { name: 'user_id', type: 'String', default: null },
  { name: 'event_type', type: 'String', default: null },
  { name: 'timestamp', type: 'DateTime', default: null },
  { name: 'data', type: 'JSON', default: null },
  { name: 'created_at', type: 'DateTime', default: null },
]
