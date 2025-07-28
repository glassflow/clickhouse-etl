// Shared pipeline types used across the application

// Type for pipeline list endpoint (matches backend ListPipelineConfig)
export interface ListPipelineConfig {
  pipeline_id: string
  name: string
  transformation_type: 'Join' | 'Join & Deduplication' | 'Deduplication' | 'Ingest Only'
  created_at: string
  state: string
}

// Type for DLQ state (matches backend dlqStateResponse)
export interface DLQState {
  last_received_at: string | null
  last_consumed_at: string | null
  total_messages: number
  unconsumed_messages: number
}

export interface Pipeline {
  id: string
  name: string
  status: 'active' | 'terminated' | 'deleted' | 'paused' | 'pausing' | 'deleting' | 'error'
  created_at: string
  updated_at: string
  transformationName?: string
  source: {
    type: string
    provider: string
    connection_params: {
      brokers: string[]
      protocol: string
      mechanism: string
      username?: string
      password?: string
      root_ca?: string
    }
    topics: Array<{
      consumer_group_initial_offset: string
      name: string
      schema: {
        type: string
        fields: Array<{
          name: string
          type: string
        }>
      }
      deduplication: {
        enabled: boolean
        id_field: string
        id_field_type: string
        time_window: string
      }
    }>
  }
  join: {
    enabled: boolean
    type?: string
    sources?: Array<{
      source_id: string
      join_key: string
      time_window: string
      orientation: 'left' | 'right'
    }>
  }
  sink: {
    type: string
    provider: string
    host: string
    port: string
    nativePort?: string
    database: string
    username?: string
    password?: string
    secure: boolean
    max_batch_size: number
    max_delay_time: string
    table: string
    table_mapping: Array<{
      source_id: string
      field_name: string
      column_name: string
      column_type: string
    }>
  }
  stats: {
    events_processed: number
    events_failed: number
    throughput_per_second: number
    last_event_processed: string | null
  }
  error?: string
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

export interface DLQStats {
  total_failed_events: number
  failed_events_today: number
  last_failure: string
  failure_rate: number
  top_error_types: Array<{ error_type: string; count: number }>
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
