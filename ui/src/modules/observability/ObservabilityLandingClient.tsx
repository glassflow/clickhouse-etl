'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  PauseCircleIcon,
  InboxIcon,
  ArrowRightIcon,
  ActivityIcon,
} from 'lucide-react'
import { getPipelines } from '@/src/api/pipeline-api'
import type { ListPipelineConfig } from '@/src/types/pipeline'
import { StatusBadge } from '@/src/components/shared/StatusBadge'
import type { StatusType } from '@/src/config/constants'
import { cn } from '@/src/utils/common.client'

function isValidStatus(s: string | undefined): s is StatusType {
  return !!s && s !== ''
}

function isDegraded(p: ListPipelineConfig): boolean {
  return p.status === 'failed' || p.health_status === 'unstable'
}

function sortPriority(p: ListPipelineConfig): number {
  if (isDegraded(p)) return 0
  if (p.status === 'active') return 1
  if (p.status === 'paused' || p.status === 'pausing') return 2
  return 3
}

export function ObservabilityLandingClient() {
  const [pipelines, setPipelines] = useState<ListPipelineConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPipelines()
      .then(setPipelines)
      .catch(() => setError('Failed to load pipeline data'))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <span className="caption-1 text-[var(--text-secondary)]">Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="body-3 text-[var(--color-foreground-critical)]">{error}</p>
      </div>
    )
  }

  const running = pipelines.filter((p) => p.status === 'active').length
  const degraded = pipelines.filter(isDegraded).length
  const paused = pipelines.filter((p) => p.status === 'paused' || p.status === 'pausing').length
  const totalDlq = pipelines.reduce((n, p) => n + (p.dlq_stats?.unconsumed_messages ?? 0), 0)

  const sorted = [...pipelines].sort((a, b) => sortPriority(a) - sortPriority(b))

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex flex-col gap-1">
        <h1 className="title-2 text-[var(--text-primary)]">Observability</h1>
        <p className="body-3 text-[var(--text-secondary)]">
          Pipeline health and DLQ activity across your workspace
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Running"
          value={running}
          icon={<CheckCircle2Icon size={15} />}
          valueClass="text-[var(--color-foreground-positive)]"
        />
        <StatCard
          label="Needs attention"
          value={degraded}
          icon={<AlertCircleIcon size={15} />}
          valueClass={
            degraded > 0
              ? 'text-[var(--color-foreground-critical)]'
              : 'text-[var(--text-secondary)]'
          }
        />
        <StatCard
          label="Paused"
          value={paused}
          icon={<PauseCircleIcon size={15} />}
          valueClass="text-[var(--text-secondary)]"
        />
        <StatCard
          label="DLQ backlog"
          value={totalDlq}
          icon={<InboxIcon size={15} />}
          valueClass={
            totalDlq > 0
              ? 'text-[var(--color-foreground-critical)]'
              : 'text-[var(--text-secondary)]'
          }
          sub="unconsumed msgs"
        />
      </div>

      {pipelines.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="caption-1 text-[var(--text-tertiary)]">
            All pipelines ({pipelines.length})
          </p>
          <div className="rounded-xl border border-[var(--surface-border)] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr
                  className="border-b border-[var(--surface-border)]"
                  style={{ backgroundColor: 'var(--table-header-bg)' }}
                >
                  <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium">
                    Pipeline
                  </th>
                  <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium hidden sm:table-cell">
                    Type
                  </th>
                  <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium hidden md:table-cell">
                    DLQ backlog
                  </th>
                  <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium hidden md:table-cell">
                    Throughput
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, idx) => (
                  <PipelineRow
                    key={p.pipeline_id}
                    pipeline={p}
                    isLast={idx === sorted.length - 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  valueClass,
  sub,
}: {
  label: string
  value: number
  icon: React.ReactNode
  valueClass?: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-bg)] px-4 py-4">
      <div className="flex items-center gap-1.5 caption-1 text-[var(--text-tertiary)]">
        <span className="shrink-0">{icon}</span>
        {label}
      </div>
      <div className={cn('title-3', valueClass)}>{value}</div>
      {sub && <p className="caption-2 text-[var(--text-tertiary)] -mt-1">{sub}</p>}
    </div>
  )
}

function PipelineRow({
  pipeline: p,
  isLast,
}: {
  pipeline: ListPipelineConfig
  isLast: boolean
}) {
  const dlqCount = p.dlq_stats?.unconsumed_messages ?? 0
  const status = isValidStatus(p.status as string) ? (p.status as StatusType) : undefined
  const degraded = isDegraded(p)

  return (
    <tr
      className={cn(
        'group transition-colors',
        !isLast && 'border-b border-[var(--surface-border)]',
        degraded && 'bg-[var(--color-background-critical-faded,var(--surface-bg))]',
      )}
      style={{
        backgroundColor: degraded ? undefined : 'var(--table-row-bg)',
      }}
    >
      <td className="px-4 py-3">
        <Link
          href={`/observability/${p.pipeline_id}`}
          className="body-3 font-medium text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)] transition-colors"
        >
          {p.name}
        </Link>
      </td>
      <td className="px-4 py-3 caption-1 text-[var(--text-secondary)] hidden sm:table-cell">
        {p.transformation_type}
      </td>
      <td className="px-4 py-3">
        {status ? (
          <StatusBadge status={status} />
        ) : (
          <span className="caption-1 text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        {dlqCount > 0 ? (
          <span className="caption-1 tabular-nums text-[var(--color-foreground-critical)]">
            {dlqCount.toLocaleString()}
          </span>
        ) : (
          <span className="caption-1 text-[var(--text-tertiary)]">0</span>
        )}
      </td>
      <td className="px-4 py-3 caption-1 text-[var(--text-tertiary)] hidden md:table-cell">—</td>
      <td className="px-4 py-3">
        <Link
          href={`/observability/${p.pipeline_id}`}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg-hover)] transition-colors"
          aria-label={`View ${p.name} details`}
        >
          <ArrowRightIcon size={13} />
        </Link>
      </td>
    </tr>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <div
        className="w-12 h-12 rounded-xl border border-[var(--surface-border)] grid place-items-center text-[var(--text-tertiary)]"
      >
        <ActivityIcon size={22} strokeWidth={1.5} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="body-2 font-medium text-[var(--text-primary)]">No pipelines yet</p>
        <p className="body-3 text-[var(--text-secondary)]">
          Create a pipeline to start monitoring health and DLQ activity.
        </p>
      </div>
      <Link
        href="/home"
        className="caption-1 text-[var(--color-foreground-primary)] hover:underline"
      >
        Create your first pipeline →
      </Link>
    </div>
  )
}
