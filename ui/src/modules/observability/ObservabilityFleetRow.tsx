'use client'

import Link from 'next/link'
import { Sparkline } from '@/src/components/ui/sparkline'
import { StatusBadge } from '@/src/components/shared/StatusBadge'
import { useFleetSparkline } from '@/src/hooks/useFleetSparkline'
import { cn } from '@/src/utils/common.client'
import { PIPELINE_STATUS_CONFIG } from '@/src/config/constants'
import type { StatusType } from '@/src/config/constants'
import type { ListPipelineConfig } from '@/src/types/pipeline'
import { isDegraded, isPaused } from './pipeline-health'

function toStatusType(status: string | undefined): StatusType | null {
  if (!status) return null
  return status in PIPELINE_STATUS_CONFIG ? (status as StatusType) : null
}

type Props = {
  pipeline: ListPipelineConfig
  fromMs: number
  toMs: number
  step: string
  autoRefreshIntervalMs: number | null
  isLast: boolean
}

export function ObservabilityFleetRow({ pipeline, fromMs, toMs, step, autoRefreshIntervalMs, isLast }: Props) {
  const paused = isPaused(pipeline)
  const degraded = isDegraded(pipeline)
  const dlqCount = pipeline.dlq_stats?.unconsumed_messages ?? 0

  const throughput = useFleetSparkline(
    paused ? '' : pipeline.pipeline_id,
    'records_ingested',
    fromMs,
    toMs,
    step,
    autoRefreshIntervalMs,
  )
  const errors = useFleetSparkline(
    paused ? '' : pipeline.pipeline_id,
    'errors_total',
    fromMs,
    toMs,
    step,
    autoRefreshIntervalMs,
  )

  const errorRate =
    errors.latest != null && throughput.latest != null && throughput.latest > 0
      ? (errors.latest / throughput.latest) * 100
      : null

  const errorsLink =
    errors.latest != null && errors.latest > 0
      ? `/pipelines/${pipeline.pipeline_id}/logs`
      : `/pipelines/${pipeline.pipeline_id}/metrics`

  const throughputLabel =
    throughput.latest != null
      ? throughput.latest >= 1000
        ? `${(throughput.latest / 1000).toFixed(1)}k ev/s`
        : `${throughput.latest.toFixed(0)} ev/s`
      : null

  const statusType = toStatusType(pipeline.status as string | undefined)

  return (
    <tr
      className={cn(
        'group transition-colors',
        !isLast && 'border-b border-[var(--surface-border)]',
        degraded && 'bg-[var(--color-background-critical-faded,var(--surface-bg))]',
        !degraded && 'bg-[var(--table-row-bg)]',
        paused && 'opacity-55',
      )}
    >
      {/* Pipeline name */}
      <td className="px-4 py-3">
        <Link
          href={`/pipelines/${pipeline.pipeline_id}/metrics`}
          className="body-3 font-medium text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)] transition-colors"
        >
          {pipeline.name}
        </Link>
        <div className="caption-2 text-[var(--text-tertiary)] mt-0.5">{pipeline.transformation_type}</div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">{statusType != null && <StatusBadge status={statusType} />}</td>

      {/* Throughput sparkline */}
      <td className="px-4 py-3">
        {paused ? (
          <span className="caption-1 text-[var(--text-tertiary)]">—</span>
        ) : (
          <Link href={`/pipelines/${pipeline.pipeline_id}/metrics`} className="flex items-center gap-2">
            {!throughput.isLoading && throughput.values.length > 0 && (
              <Sparkline
                data={throughput.values}
                width={72}
                height={20}
                stroke="var(--color-foreground-positive)"
                strokeWidth={1.5}
              />
            )}
            {throughput.isLoading && (
              <span className="inline-block w-[72px] h-[20px] rounded bg-[var(--surface-border)] animate-pulse" />
            )}
            <span className="caption-1 text-[var(--text-secondary)] tabular-nums">{throughputLabel ?? '—'}</span>
          </Link>
        )}
      </td>

      {/* Error rate sparkline */}
      <td className="px-4 py-3">
        {paused ? (
          <span className="caption-1 text-[var(--text-tertiary)]">—</span>
        ) : (
          <Link href={errorsLink} className="flex items-center gap-2">
            {!errors.isLoading && errors.values.length > 0 && (
              <Sparkline
                data={errors.values}
                width={56}
                height={20}
                stroke={(errorRate ?? 0) > 0 ? 'var(--color-foreground-critical)' : 'var(--text-tertiary)'}
                strokeWidth={1.5}
              />
            )}
            {errors.isLoading && (
              <span className="inline-block w-[56px] h-[20px] rounded bg-[var(--surface-border)] animate-pulse" />
            )}
            <span
              className={cn(
                'caption-1 tabular-nums',
                (errorRate ?? 0) > 0 ? 'text-[var(--color-foreground-critical)]' : 'text-[var(--text-tertiary)]',
              )}
            >
              {errors.isLoading
                ? '…'
                : errorRate != null
                  ? `${errorRate.toFixed(1)}%`
                  : errors.latest != null && errors.latest > 0
                    ? `${errors.latest.toFixed(1)}/s`
                    : '0.0%'}
            </span>
          </Link>
        )}
      </td>

      {/* DLQ */}
      <td className="px-4 py-3">
        <Link
          href={dlqCount > 0 ? `/pipelines/${pipeline.pipeline_id}/dlq` : `/pipelines/${pipeline.pipeline_id}/metrics`}
          aria-label={String(dlqCount)}
          className={cn(
            'caption-1 tabular-nums',
            dlqCount > 0 ? 'text-[var(--color-foreground-critical)] font-semibold' : 'text-[var(--text-tertiary)]',
          )}
        >
          {dlqCount}
        </Link>
      </td>

      {/* Chevron */}
      <td className="px-3 py-3">
        <Link
          href={`/pipelines/${pipeline.pipeline_id}/metrics`}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg-hover)] transition-colors"
          aria-label="View metrics"
        >
          <span aria-hidden="true" className="caption-1">
            ›
          </span>
        </Link>
      </td>
    </tr>
  )
}
