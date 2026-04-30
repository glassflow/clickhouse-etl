import type { CanonicalQueryKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'

export type ChartSpec = {
  key: CanonicalQueryKey
  title: string
  unit?: string
}

export const HERO_CARDS: ChartSpec[] = [
  { key: 'records_ingested', title: 'Records ingested', unit: 'rec/s' },
  { key: 'latency_p99', title: 'p99 latency', unit: 's' },
  { key: 'dlq_rate', title: 'DLQ rate', unit: '/s' },
]

export const CHART_GRID: ChartSpec[] = [
  { key: 'records_ingested', title: 'Records ingested', unit: 'rec/s' },
  { key: 'records_processed', title: 'Records processed', unit: 'rec/s' },
  { key: 'records_sunk', title: 'Records sunk', unit: 'rec/s' },
  { key: 'latency_p95', title: 'Latency p95', unit: 's' },
  { key: 'errors_total', title: 'Errors', unit: '/s' },
  { key: 'consumer_lag', title: 'Consumer lag', unit: 'msg' },
]
