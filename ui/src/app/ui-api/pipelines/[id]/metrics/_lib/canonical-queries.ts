/**
 * Canonical query catalog.
 *
 * The UI never sends free-form PromQL — it sends a query *name* (e.g.
 * `records_ingested`) which is mapped server-side to a canonical PromQL
 * string. This:
 *   1. Locks the surface area of metrics the UI exposes
 *   2. Keeps PromQL details server-only (the proxy still scope-enforces)
 *   3. Means UI cards can reference a stable identifier, not a string
 */

export type CanonicalQueryKey =
  | 'records_ingested'
  | 'records_processed'
  | 'records_sunk'
  | 'latency_p50'
  | 'latency_p95'
  | 'latency_p99'
  | 'errors_total'
  | 'dlq_rate'
  | 'consumer_lag'

export const CANONICAL_QUERIES: Record<CanonicalQueryKey, string> = {
  records_ingested: 'sum(rate(glassflow_records_ingested_total[1m]))',
  records_processed: 'sum(rate(glassflow_records_processed_total[1m]))',
  records_sunk: 'sum(rate(glassflow_records_sunk_total[1m]))',
  latency_p50:
    'histogram_quantile(0.50, sum by (le) (rate(glassflow_pipeline_latency_seconds_bucket[5m])))',
  latency_p95:
    'histogram_quantile(0.95, sum by (le) (rate(glassflow_pipeline_latency_seconds_bucket[5m])))',
  latency_p99:
    'histogram_quantile(0.99, sum by (le) (rate(glassflow_pipeline_latency_seconds_bucket[5m])))',
  errors_total: 'sum(rate(glassflow_errors_total[1m]))',
  dlq_rate: 'sum(rate(glassflow_dlq_total[1m]))',
  consumer_lag: 'max(glassflow_kafka_consumer_lag)',
}

export function isCanonicalKey(s: string): s is CanonicalQueryKey {
  return s in CANONICAL_QUERIES
}
