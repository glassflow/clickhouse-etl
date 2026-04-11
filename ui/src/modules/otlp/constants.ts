import { SourceType } from '@/src/config/source-types'

export interface OtlpSchemaField {
  name: string
  type: string
}

export const OTLP_LOGS_FIELDS: OtlpSchemaField[] = [
  { name: 'timestamp', type: 'string' },
  { name: 'observed_timestamp', type: 'string' },
  { name: 'severity_number', type: 'uint' },
  { name: 'severity_text', type: 'string' },
  { name: 'body', type: 'string' },
  { name: 'trace_id', type: 'string' },
  { name: 'span_id', type: 'string' },
  { name: 'flags', type: 'uint' },
  { name: 'dropped_attributes_count', type: 'uint' },
  { name: 'resource_attributes', type: 'map' },
  { name: 'scope_name', type: 'string' },
  { name: 'scope_version', type: 'string' },
  { name: 'scope_attributes', type: 'map' },
  { name: 'attributes', type: 'map' },
]

export const OTLP_TRACES_FIELDS: OtlpSchemaField[] = [
  { name: 'trace_id', type: 'string' },
  { name: 'span_id', type: 'string' },
  { name: 'parent_span_id', type: 'string' },
  { name: 'trace_state', type: 'string' },
  { name: 'flags', type: 'uint' },
  { name: 'name', type: 'string' },
  { name: 'kind', type: 'string' },
  { name: 'start_timestamp', type: 'string' },
  { name: 'end_timestamp', type: 'string' },
  { name: 'duration_ns', type: 'uint' },
  { name: 'status_code', type: 'string' },
  { name: 'status_message', type: 'string' },
  { name: 'dropped_attributes_count', type: 'uint' },
  { name: 'dropped_events_count', type: 'uint' },
  { name: 'dropped_links_count', type: 'uint' },
  { name: 'events', type: 'array' },
  { name: 'links', type: 'array' },
  { name: 'resource_attributes', type: 'map' },
  { name: 'scope_name', type: 'string' },
  { name: 'scope_version', type: 'string' },
  { name: 'scope_attributes', type: 'map' },
  { name: 'attributes', type: 'map' },
]

export const OTLP_METRICS_FIELDS: OtlpSchemaField[] = [
  { name: 'timestamp', type: 'string' },
  { name: 'start_timestamp', type: 'string' },
  { name: 'metric_name', type: 'string' },
  { name: 'metric_description', type: 'string' },
  { name: 'metric_unit', type: 'string' },
  { name: 'metric_type', type: 'string' },
  { name: 'aggregation_temporality', type: 'string' },
  { name: 'is_monotonic', type: 'bool' },
  { name: 'flags', type: 'uint' },
  { name: 'value_double', type: 'float' },
  { name: 'value_int', type: 'int' },
  { name: 'count', type: 'uint' },
  { name: 'sum', type: 'float' },
  { name: 'min', type: 'float' },
  { name: 'max', type: 'float' },
  { name: 'bucket_counts', type: 'array' },
  { name: 'explicit_bounds', type: 'array' },
  { name: 'resource', type: 'map' },
  { name: 'scope_name', type: 'string' },
  { name: 'scope_version', type: 'string' },
  { name: 'scope_attributes', type: 'map' },
  { name: 'attributes', type: 'map' },
]

export function getOtlpFieldsForSignalType(sourceType: SourceType | string): OtlpSchemaField[] {
  switch (sourceType) {
    case SourceType.OTLP_LOGS: return OTLP_LOGS_FIELDS
    case SourceType.OTLP_TRACES: return OTLP_TRACES_FIELDS
    case SourceType.OTLP_METRICS: return OTLP_METRICS_FIELDS
    default: return []
  }
}
