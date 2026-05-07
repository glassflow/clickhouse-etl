'use client'

import Link from 'next/link'
import { ChevronRightIcon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

// ─── Dot indicator ────────────────────────────────────────────────────────────

function HealthDot({ health }: { health: UsedByEntry['health'] }) {
  const colorMap = {
    ok: 'bg-[var(--color-green-500)]',
    warn: 'bg-[var(--color-yellow-400)]',
    err: 'bg-[var(--color-red-400)]',
  } as const
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorMap[health]}`}
      aria-label={health}
    />
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  entries: UsedByEntry[]
  emptyLabel?: string
}

export function UsedByTable({ entries, emptyLabel = 'Not used by any pipeline.' }: Props) {
  if (entries.length === 0) {
    return <p className="body-3 text-[var(--text-secondary)]">{emptyLabel}</p>
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[1fr_auto_auto_auto_16px] gap-x-4 pb-2 border-b border-[var(--surface-border)]">
        <span className="caption-1 text-[var(--text-tertiary)]">Pipeline</span>
        <span className="caption-1 text-[var(--text-tertiary)]">Pinned</span>
        <span className="caption-1 text-[var(--text-tertiary)]">Drift</span>
        <span className="caption-1 text-[var(--text-tertiary)]">Status</span>
        <span />
      </div>
      {entries.map((entry) => (
        <UsedByRow key={entry.pipelineId} entry={entry} />
      ))}
    </div>
  )
}

function UsedByRow({ entry }: { entry: UsedByEntry }) {
  const driftChip = entry.drift
    ? <Badge variant="warning" className="font-mono">drift</Badge>
    : <span className="caption-1 text-[var(--text-tertiary)]">in sync</span>

  const statusVariant = entry.status === 'active' ? 'success' : 'secondary'

  return (
    <Link
      href={`/pipelines/${entry.pipelineId}`}
      className="grid grid-cols-[1fr_auto_auto_auto_16px] gap-x-4 items-center py-2.5 border-b border-[var(--surface-border)] last:border-0 hover:bg-[var(--interactive-hover-bg)] -mx-5 px-5 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <HealthDot health={entry.health} />
        <span className="body-3 text-[var(--text-primary)] truncate">{entry.pipelineName}</span>
      </div>
      <span className="body-3 font-mono text-[var(--text-secondary)] whitespace-nowrap">
        {entry.pinnedVersion ?? '—'}
      </span>
      <div>{driftChip}</div>
      <Badge variant={statusVariant}>{entry.status}</Badge>
      <ChevronRightIcon size={14} className="text-[var(--text-tertiary)]" />
    </Link>
  )
}
