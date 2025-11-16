// types/pipeline.ts
export type KafkaConnectionParams = {
  brokers: string[]
  protocol: string
  skip_auth?: boolean
  sasl_tls_enable?: boolean
  skip_tls_verification?: boolean
  mechanism: string
  username: string
  password: string
  root_ca?: string
}

export type TopicSchema = {
  type: string
  fields: Array<{
    name: string
    type: string
  }>
}

export type TopicDeduplication = {
  enabled: boolean
  id_field: string
  id_field_type: string
  time_window: string
}

export type Topic = {
  consumer_group_initial_offset: string
  name: string
  id: string
  schema: TopicSchema
  deduplication?: TopicDeduplication
}

export type KafkaSource = {
  type: 'kafka'
  provider: string
  connection_params: KafkaConnectionParams
  topics: Topic[]
}

export type ClickhouseSink = {
  type: 'clickhouse'
  provider: string
  host: string
  httpPort: string
  database: string
  username: string
  password: string
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

export type ApiConfig = {
  pipeline_id?: string
  source: KafkaSource
  sink: ClickhouseSink
}

export type StepType = 'kafka' | 'clickhouse' | 'deduplication' | 'join' | 'deduplication_join' | 'ingest-only' | null
