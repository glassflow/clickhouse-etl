// Shared pipeline types used across the application

import { PIPELINE_STATUS_MAP } from '../config/constants'

export type PipelineStatus = keyof typeof PIPELINE_STATUS_MAP

export type PipelineAction = 'edit' | 'rename' | 'stop' | 'delete' | 'pause' | 'resume'

// Pipeline state values that can come from the backend
export type PipelineState = 'active' | 'paused' | 'stopped' | 'error' | ''

// Helper function to parse backend status to UI status
export const parsePipelineStatus = (status: string): PipelineStatus => {
  // Handle empty status as 'active' to allow editing
  if (!status || status.trim() === '') {
    return 'active'
  }

  // Convert first letter to lowercase to match UI status format
  const normalizedStatus = status.charAt(0).toLowerCase() + status.slice(1)

  switch (normalizedStatus) {
    case 'running':
    case 'active':
      return 'active'
    case 'paused':
      return 'paused'
    case 'pausing':
      return 'pausing'
    case 'resuming':
      return 'pausing' // Map resuming to pausing (transitional state)
    case 'stopped':
    case 'terminated':
    case 'deleted':
      return 'stopped'
    case 'stopping':
    case 'terminating':
    case 'deleting':
      return 'stopping'
    case 'failed':
    case 'error':
    case 'deploy_failed':
    case 'delete_failed':
      return 'failed'
    case 'deploying':
    case 'no_configuration':
      return 'active' // Treat as active to allow configuration
    default:
      return 'active' // Default to active for unknown states (allows editing)
  }
}

// Helper function to detect transformation type from pipeline configuration
export const detectTransformationType = (
  pipeline: Pipeline,
): 'Join' | 'Join & Deduplication' | 'Deduplication' | 'Ingest Only' => {
  const hasJoin = Boolean(
    pipeline?.join?.enabled === true && Array.isArray(pipeline?.join?.sources) && pipeline.join.sources.length > 0,
  )

  const isTopicDedup = (t: any): boolean => {
    const d = t?.deduplication
    const enabled = d?.enabled === true || d?.enabled === 'true'
    const key = typeof d?.id_field === 'string' ? d.id_field.trim() : ''
    return enabled && key.length > 0
  }

  const topics = Array.isArray(pipeline?.source?.topics) ? pipeline.source.topics : []
  const dedupCount = topics.filter(isTopicDedup).length
  const hasAnyDedup = dedupCount > 0
  const hasBothDedup = topics.length > 1 && dedupCount >= 2

  if (hasJoin && hasBothDedup) return 'Join & Deduplication'
  if (hasJoin) return 'Join'
  if (hasAnyDedup) return 'Deduplication'
  return 'Ingest Only'
}

// Type for pipeline list endpoint (matches backend ListPipelineConfig)
export interface ListPipelineConfig {
  pipeline_id: string
  name: string
  transformation_type: 'Join' | 'Join & Deduplication' | 'Deduplication' | 'Ingest Only'
  created_at: string
  state?: string // Pipeline status from backend State field (legacy)
  status?: string | PipelineStatus // Pipeline status from backend (new format) or UI status field (converted)
  dlq_stats?: {
    total_messages: number
    unconsumed_messages: number
    last_received_at: string | null
    last_consumed_at: string | null
  }
  health_status?: 'stable' | 'unstable' // Based on DLQ stats: stable if unconsumed_messages = 0, unstable otherwise
}

// Type for DLQ state (matches backend dlqStateResponse)
export interface DLQState {
  last_received_at: string | null
  last_consumed_at: string | null
  total_messages: number
  unconsumed_messages: number
}

export interface Pipeline {
  pipeline_id: string
  name: string
  state: string // Pipeline status from backend State field
  status?: PipelineStatus // UI status field (converted from state)
  created_at?: string // Creation timestamp
  source: {
    type: string
    provider: string
    connection_params: {
      brokers: string[]
      skip_auth: boolean
      protocol: string
      mechanism: string
      username?: string
      password?: string
      root_ca?: string
    }
    topics: Array<{
      name: string
      id: string
      schema: {
        type: string
        fields: Array<{
          name: string
          type: string
        }>
      }
      consumer_group_initial_offset: string
      deduplication: {
        enabled: boolean
        id_field: string
        id_field_type: string
        time_window: string
      }
    }>
  }
  join: {
    type: string
    enabled: boolean
    sources: Array<{
      source_id: string
      join_key: string
      time_window: string
      orientation: string
    }>
  }
  sink: {
    type: string
    host: string
    httpPort: string
    nativePort?: string // Optional native port for ClickHouse
    database: string
    username?: string
    password?: string
    table: string
    secure: boolean
    table_mapping: Array<{
      source_id: string
      field_name: string
      column_name: string
      column_type: string
    }>
    max_batch_size: number
    max_delay_time: string
    skip_certificate_verification: boolean
  }
}

export interface Schema {
  id: string
  name: string
  version: string
  created_at: string
  updated_at: string
  schema: Record<string, any>
  mappings: Record<string, any>
}

export interface Connection {
  id: string
  name: string
  type: 'kafka' | 'clickhouse'
  created_at: string
  updated_at: string
  config: Record<string, any>
}

export interface DLQEvent {
  id: string
  original_event: Record<string, any>
  error: string
  failed_at: string
  retry_count: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  code: number
  message: string
}

export interface PipelineError {
  code: number
  message: string
}

export interface PipelineResponse {
  pipeline_id: string
  status: PipelineStatus // UI status (converted from backend state)
  error?: string
}
