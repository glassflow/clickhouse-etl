'use client'

import { useState } from 'react'
import { cn } from '@/src/utils/common.client'
import { DataTable, type DataTableColumn, type RowStatus } from '@/src/components/ui/data-table'
import type { DashPipeline, DashPipelineStatus } from '../types'

// ─── Status chip ───────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<DashPipelineStatus, { chip: string; dot: string }> = {
  run: {
    chip: 'bg-[var(--color-green-750)] text-[var(--color-green-500)]',
    dot: 'bg-[var(--color-green-500)] shadow-[0_0_0_2px_var(--color-green-alpha-20)]',
  },
  deg: { chip: 'bg-[var(--color-yellow-alpha-8)] text-[var(--color-yellow-400)]', dot: 'bg-[var(--color-yellow-400)]' },
  fail: { chip: 'bg-[var(--color-red-750)] text-[var(--color-red-500)]', dot: 'bg-[var(--color-red-500)]' },
  paused: { chip: 'bg-[var(--color-blue-750)] text-[var(--color-blue-500)]', dot: 'bg-[var(--color-blue-500)]' },
  draft: {
    chip: 'bg-[var(--color-white-alpha-4)] text-[var(--color-gray-100)] border border-[var(--color-gray-dark-700)]',
    dot: 'bg-[var(--color-gray-dark-100)]',
  },
}

function StatusChip({ kind, label }: { kind: DashPipelineStatus; label: string }) {
  const { chip, dot } = STATUS_CHIP[kind] ?? STATUS_CHIP.draft
  return (
    <span
      data-status={kind}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-medium tracking-[0.02em]',
        chip,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dot)} aria-hidden="true" />
      {label}
    </span>
  )
}

// ─── Metric cell ───────────────────────────────────────────────────────────────

function MetricCell({ value, unit, sub, severity }: { value: string; unit?: string; sub?: string; severity?: string }) {
  return (
    <div
      data-severity={severity || undefined}
      className={cn(
        'font-mono text-[12px]',
        severity === 'warn'
          ? 'text-[var(--color-yellow-400)]'
          : severity === 'crit'
            ? 'text-[var(--color-red-500)]'
            : 'text-[var(--color-foreground-neutral)]',
      )}
    >
      {value}
      {unit && <span className="text-[10.5px] text-[var(--color-gray-dark-500)] ml-0.5">{unit}</span>}
      {sub && <span className="block text-[10px] text-[var(--color-gray-dark-500)] mt-0.5">{sub}</span>}
    </div>
  )
}

// ─── Filter chip ───────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'run' | 'deg' | 'paused' | 'draft'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'run', label: 'Running' },
  { key: 'deg', label: 'Degraded' },
  { key: 'paused', label: 'Paused' },
  { key: 'draft', label: 'Drafts' },
]

// ─── Columns ───────────────────────────────────────────────────────────────────

const columns: DataTableColumn<DashPipeline>[] = [
  {
    key: 'name',
    header: 'Pipeline',
    width: '2fr',
    render: (p) => (
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-[13px] font-semibold font-[family-name:var(--font-family-title)] text-[var(--color-foreground-neutral)] flex items-center gap-2 truncate">
          <span className="truncate">{p.name}</span>
          <span className="font-mono text-[10px] font-normal text-[var(--color-gray-dark-500)] bg-[var(--dash-element-bg)] px-1.5 py-px rounded-[3px] shrink-0">
            {p.version}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: 'route',
    header: 'Source → destination',
    width: '2.5fr',
    render: (p) => (
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-gray-dark-100)] min-w-0">
        <span className="truncate">{p.sourceTopic}</span>
        <span className="text-[var(--color-gray-dark-500)] shrink-0">→</span>
        <span className="truncate">{p.destTable}</span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '1.2fr',
    render: (p) => <StatusChip kind={p.status} label={p.statusLabel} />,
  },
  {
    key: 'throughput',
    header: 'Throughput',
    width: '1fr',
    align: 'right',
    render: (p) => <MetricCell value={p.throughput} unit={p.throughputUnit} />,
  },
  {
    key: 'lag',
    header: 'Lag · p95',
    width: '1fr',
    align: 'right',
    render: (p) => <MetricCell value={p.lagP95} unit={p.lagUnit} severity={p.lagSeverity} />,
  },
  {
    key: 'dlq',
    header: 'DLQ',
    width: '0.8fr',
    align: 'right',
    render: (p) => <MetricCell value={p.dlq || '0'} severity={p.dlqSeverity} />,
  },
  {
    key: 'lastDeploy',
    header: 'Last deploy',
    width: '1.5fr',
    render: (p) => (
      <>
        <span className="font-mono text-[11.5px] text-[var(--color-foreground-neutral)]">{p.lastDeploy}</span>
        <span className="font-mono text-[11px] text-[var(--color-gray-dark-500)]"> · {p.deployedBy}</span>
      </>
    ),
  },
]

function rowStatus(p: DashPipeline): RowStatus | undefined {
  if (p.status === 'fail') return 'critical'
  if (p.status === 'deg') return 'warning'
  return undefined
}

// ─── Table ─────────────────────────────────────────────────────────────────────

type Props = { pipelines: DashPipeline[] }

export function PipelineTable({ pipelines }: Props) {
  const [active, setActive] = useState<FilterKey>('all')

  const counts: Record<FilterKey, number> = {
    all: pipelines.length,
    run: pipelines.filter((p) => p.status === 'run').length,
    deg: pipelines.filter((p) => p.status === 'deg').length,
    paused: pipelines.filter((p) => p.status === 'paused').length,
    draft: pipelines.filter((p) => p.status === 'draft').length,
  }

  const visible = active === 'all' ? pipelines : pipelines.filter((p) => p.status === active)

  return (
    <div
      className="mx-10 my-6 bg-[var(--dash-card-bg)] border border-[var(--color-gray-dark-700)] rounded-[10px] overflow-hidden animate-section-enter"
      style={{ animationDelay: '120ms' }}
    >
      {/* Section header with filter chips */}
      <div className="flex items-center justify-between px-5 py-[14px] border-b border-[var(--color-gray-dark-800)]">
        <h3 className="title-6 font-semibold m-0 text-[var(--color-foreground-neutral)]">Pipelines</h3>
        <div className="flex items-center gap-1.5">
          {FILTERS.map(({ key, label }) => {
            const isActive = active === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                aria-pressed={isActive}
                className={cn(
                  'px-[10px] py-1 text-[11px] rounded-[5px] border cursor-pointer transition-colors duration-[120ms] focus-ring',
                  isActive
                    ? 'bg-[var(--color-orange-alpha-10)] border-[var(--color-orange-300)] text-[var(--color-orange-300)]'
                    : 'bg-transparent border-[var(--color-gray-dark-700)] text-[var(--color-gray-dark-100)] hover:border-[var(--color-gray-dark-500)]',
                )}
              >
                {label}
                <span
                  className={cn(
                    'font-mono text-[10px] ml-1',
                    isActive ? 'text-[var(--color-orange-300)]' : 'text-[var(--color-gray-dark-500)]',
                  )}
                >
                  {counts[key]}
                </span>
              </button>
            )
          })}
          <div className="flex-1" />
          <button
            type="button"
            className="px-[10px] py-1 text-[11px] rounded-[5px] border border-[var(--color-gray-dark-700)] bg-transparent text-[var(--color-gray-dark-100)] cursor-pointer hover:border-[var(--color-gray-dark-500)] transition-colors duration-[120ms] focus-ring"
          >
            Sort: throughput ▾
          </button>
        </div>
      </div>

      {/* Body rendered via shared DataTable primitive */}
      <DataTable
        className="pipelines-table compact-rows !rounded-none !border-0"
        data={visible}
        columns={columns}
        getRowId={(p) => p.id}
        rowStatus={rowStatus}
        ariaLabel="Dashboard pipelines"
      />
    </div>
  )
}
