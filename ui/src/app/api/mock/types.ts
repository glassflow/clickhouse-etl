// Type definition for pipeline
export interface Pipeline {
  id: string
  name: string
  status: PipelineStatus
  created_at: string
  updated_at: string
  config: {
    kafka: {
      topics: string[]
      consumer_group: string
    }
    clickhouse: {
      database: string
      table: string
    }
    operations: string[]
  }
  stats: {
    events_processed: number
    events_failed: number
    throughput_per_second: number
    last_event_processed: string | null
  }
  error?: string
}

export type PipelineStatus = 'active' | 'terminated' | 'deleted' | 'paused' | 'error' | 'pausing' | 'deleting'
