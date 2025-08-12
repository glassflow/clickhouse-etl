import { getPipelineStatusFromState } from '@/src/types/pipeline'
import { mockPipelines } from '@/src/app/api/mock/data/pipelines'
import { getRuntimeEnv } from '@/src/utils/common.client'

// Utility to handle mock vs real API switching
export const isMockMode = () => {
  const isServer = typeof window === 'undefined'

  if (isServer) {
    // For server-side, use process.env directly
    return process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'
  } else {
    // For client-side, check runtime environment first (for Docker builds)
    if (window.__ENV__?.NEXT_PUBLIC_USE_MOCK_API) {
      return window.__ENV__.NEXT_PUBLIC_USE_MOCK_API === 'true'
    }
    // Fallback to process.env (for development)
    return process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'
  }
}

export const getApiUrl = (endpoint: string) => {
  const isServer = typeof window === 'undefined'

  // For server-side, get environment from process.env directly
  const inDocker = process.env.NEXT_PUBLIC_IN_DOCKER === 'true'
  const useMockAPI = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

  // For client-side, try runtime env first, then process.env
  const runtimeEnv = !isServer ? getRuntimeEnv() : null
  const clientUseMockAPI = runtimeEnv?.NEXT_PUBLIC_USE_MOCK_API === 'true'

  const shouldUseMock = isServer ? useMockAPI : clientUseMockAPI || useMockAPI

  if (shouldUseMock) {
    if (isServer) {
      // For SSR, use localhost with the port Next.js is running on
      const port = process.env.PORT || '3000'
      return `http://localhost:${port}/api/mock/${endpoint}`
    } else {
      return `/api/mock/${endpoint}`
    }
  }

  if (isServer) {
    const baseOrigin = inDocker ? 'http://ui:8080' : 'http://localhost:3000'
    return `${baseOrigin}/api/${endpoint}`
  } else {
    return `/api/${endpoint}`
  }
}

// Mock data generators for more realistic responses
export const generateMockPipeline = (id: string = `pipeline-${Date.now()}`) => {
  // Use existing realistic mock data as base
  const basePipelines = mockPipelines
  const randomPipeline = basePipelines[Math.floor(Math.random() * basePipelines.length)]

  // Generate a realistic state based on random probability
  const states = ['active', 'paused', 'stopped', 'error']
  const state = states[Math.floor(Math.random() * states.length)]

  // Convert state to status for UI compatibility
  const status = getPipelineStatusFromState(state)

  // Create a new pipeline based on the realistic data but with the requested ID
  return {
    ...randomPipeline,
    pipeline_id: id,
    name: `Mock Pipeline ${id}`,
    state: state,
    status: status, // UI status field for compatibility
  }
}

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
