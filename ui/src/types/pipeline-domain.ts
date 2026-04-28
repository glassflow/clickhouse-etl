import type { SchemaField } from './schema'

export type SourceType = 'kafka' | 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'

export interface SourceConfig {
  type: SourceType
  /** topic name for Kafka, OTLP endpoint for OTLP sources */
  id: string
  connectionConfig: Record<string, unknown>
  schemaFields: SchemaField[]
}

export type TransformConfigType = 'deduplication' | 'join' | 'filter' | 'stateless'

export interface TransformConfig {
  type: TransformConfigType
  enabled: boolean
  config: Record<string, unknown>
}

export interface SinkConfig {
  type: 'clickhouse'
  connectionConfig: Record<string, unknown>
  tableMapping: Array<{
    sourceField: string
    targetColumn: string
    columnType: string
  }>
}

export interface ResourceConfig {
  maxBatchSize: number
  /** Go duration string e.g. "1m", "30s" */
  maxDelayTime: string
}

export interface PipelineDomain {
  id?: string
  name: string
  /** Indexed collection — replaces the old scalar `topicCount` */
  sources: SourceConfig[]
  /** Ordered transform chain */
  transforms: TransformConfig[]
  sink: SinkConfig
  resources: ResourceConfig
}
