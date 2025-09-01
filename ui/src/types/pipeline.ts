// Shared pipeline types used across the application

import { PIPELINE_STATUS_MAP } from '../config/constants'

export type PipelineStatus = keyof typeof PIPELINE_STATUS_MAP

export type PipelineAction = 'edit' | 'rename' | 'delete' | 'pause' | 'resume'

// Pipeline state values that can come from the backend
export type PipelineState = 'active' | 'paused' | 'stopped' | 'error' | ''

// Helper function to convert backend state to UI status
export const getPipelineStatusFromState = (state: string): PipelineStatus => {
  // TEMPORARY WORKAROUND: Treat empty states as 'active' to allow editing
  // TODO: Remove this when backend properly tracks pipeline state
  if (!state || state.trim() === '') {
    return 'active'
  }

  switch (state.toLowerCase()) {
    case 'active':
      return 'active'
    case 'paused':
      return 'paused'
    case 'stopped':
      return 'deleted' // Map stopped to deleted for UI consistency
    case 'terminated':
      return 'terminated'
    case 'terminating':
      return 'terminating'
    case 'deleting':
      return 'deleting'
    case 'deleted':
      return 'deleted'
    case 'deploying':
      return 'deploying'
    case 'error':
      return 'error'
    case 'deploy_failed':
      return 'deploy_failed'
    case 'delete_failed':
      return 'delete_failed'
    case 'no_configuration':
      return 'no_configuration'
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
