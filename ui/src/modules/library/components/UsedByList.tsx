'use client'

import Link from 'next/link'
import { ExternalLinkIcon } from 'lucide-react'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'
import { Pill } from '@/src/components/ui/pill'
import { EmptyState } from '@/src/components/ui/empty-state'
import { SkeletonRow } from '@/src/components/ui/skeleton'

type UsedByListProps = {
  usedBy: UsedByEntry[]
  loading?: boolean
  resourceLabel: string // "this connection" / "this schema"
}

export function UsedByList({ usedBy, loading, resourceLabel }: UsedByListProps) {
  if (loading) {
    return <SkeletonRow count={3} rowHeight={36} />
  }

  if (usedBy.length === 0) {
    return (
      <EmptyState
        heading="Not used yet"
        copy={`No pipelines reference ${resourceLabel} yet.`}
      />
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-[var(--surface-border)] rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)]">
      {usedBy.map((p) => (
        <li
          key={p.pipelineId}
          className="flex items-center justify-between gap-3 px-3 py-2.5"
        >
          <Link
            href={`/pipelines/${p.pipelineId}`}
            className="flex items-center gap-2 body-3 text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)] transition-colors"
          >
            <span>{p.pipelineName}</span>
            <ExternalLinkIcon size={12} className="opacity-60" aria-hidden="true" />
          </Link>
          {p.pinnedVersion && <Pill>{`pinned: ${p.pinnedVersion}`}</Pill>}
        </li>
      ))}
    </ul>
  )
}
