'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ActivityIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import { ObservabilityFleetRow } from './ObservabilityFleetRow'
import type { ListPipelineConfig } from '@/src/types/pipeline'

type SortBy = 'name' | 'dlq'
type SortDir = 'asc' | 'desc'

type Props = {
  pipelines: ListPipelineConfig[]
  fromMs: number
  toMs: number
  step: string
  autoRefreshIntervalMs: number | null
}

function isDegraded(p: ListPipelineConfig): boolean {
  return p.status === 'failed' || p.health_status === 'unstable'
}

function sortPriority(p: ListPipelineConfig): number {
  if (isDegraded(p)) return 0
  if (p.status === 'active') return 1
  return 2
}

type SortConfig = { by: SortBy; dir: SortDir }

function applySortAndPriority(pipelines: ListPipelineConfig[], sort: SortConfig): ListPipelineConfig[] {
  return [...pipelines].sort((a, b) => {
    const pa = sortPriority(a)
    const pb = sortPriority(b)
    if (pa !== pb) return pa - pb

    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.by === 'name') return dir * a.name.localeCompare(b.name)
    if (sort.by === 'dlq') {
      const da = a.dlq_stats?.unconsumed_messages ?? 0
      const db = b.dlq_stats?.unconsumed_messages ?? 0
      return dir * (da - db)
    }
    return 0
  })
}

export function ObservabilityFleetTable({ pipelines, fromMs, toMs, step, autoRefreshIntervalMs }: Props) {
  const [sort, setSort] = useState<SortConfig>({ by: 'dlq', dir: 'desc' })

  function toggleSort(by: SortBy) {
    setSort((s) => (s.by === by ? { by, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'desc' }))
  }

  const sorted = applySortAndPriority(pipelines, sort)

  if (pipelines.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="caption-1 text-[var(--text-tertiary)]">All pipelines ({pipelines.length})</p>
      <div className="rounded-xl border border-[var(--surface-border)] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr
              className="border-b border-[var(--surface-border)]"
              style={{ backgroundColor: 'var(--table-header-bg)' }}
            >
              <SortHeader label="Pipeline" sortKey="name" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium">Status</th>
              <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium hidden sm:table-cell">
                Throughput
              </th>
              <th className="px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium hidden md:table-cell">
                Errors
              </th>
              <SortHeader label="DLQ" sortKey="dlq" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => (
              <ObservabilityFleetRow
                key={p.pipeline_id}
                pipeline={p}
                fromMs={fromMs}
                toMs={toMs}
                step={step}
                autoRefreshIntervalMs={autoRefreshIntervalMs}
                isLast={idx === sorted.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: SortBy
  sort: SortConfig
  onSort: (k: SortBy) => void
  className?: string
}) {
  const active = sort.by === sortKey
  return (
    <th
      className={cn(
        'px-4 py-3 caption-1 text-[var(--text-tertiary)] font-medium cursor-pointer select-none hover:text-[var(--text-secondary)]',
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ChevronUpIcon size={11} />
          ) : (
            <ChevronDownIcon size={11} />
          )
        ) : (
          <span className="w-[11px]" />
        )}
      </span>
    </th>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <div className="w-12 h-12 rounded-xl border border-[var(--surface-border)] grid place-items-center text-[var(--text-tertiary)]">
        <ActivityIcon size={22} strokeWidth={1.5} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="body-2 font-medium text-[var(--text-primary)]">No pipelines yet</p>
        <p className="body-3 text-[var(--text-secondary)]">
          Create a pipeline to start monitoring health and activity.
        </p>
      </div>
      <Link href="/home" className="caption-1 text-[var(--color-foreground-primary)] hover:underline">
        Create your first pipeline →
      </Link>
    </div>
  )
}
