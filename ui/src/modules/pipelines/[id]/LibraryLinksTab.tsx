'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { EmptyState } from '@/src/components/ui/empty-state'
import { useLibraryLinks, type LibraryLink } from '@/src/hooks/useLibraryLinks'
import { UpgradeModal } from '@/src/modules/canvas/UpgradeModal'
import { LibraryListSkeleton } from '@/src/modules/library/components/LibrarySkeletons'

type LibraryLinksTabProps = { pipelineId: string }

const KIND_LABEL: Record<LibraryLink['resourceKind'], string> = {
  kafka_connection: 'Kafka connection',
  clickhouse_connection: 'ClickHouse connection',
  schema: 'Schema',
  transform: 'Transform',
}

const PIN_LABEL: Record<LibraryLink['resourceKind'], 'live' | 'pinned'> = {
  kafka_connection: 'live',
  clickhouse_connection: 'live',
  schema: 'pinned',
  transform: 'pinned',
}

export function LibraryLinksTab({ pipelineId }: LibraryLinksTabProps) {
  const { links, revision, driftCount, isLoading, mutate } = useLibraryLinks(pipelineId)
  const [upgrading, setUpgrading] = React.useState<LibraryLink | null>(null)

  if (isLoading) return <LibraryListSkeleton />

  if (links.length === 0) {
    return (
      <EmptyState
        heading="No library references yet"
        copy="This pipeline doesn't reference any Library resources. Pin connections, schemas, or transforms via Canvas to enable upgrades."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="caption-1 text-[var(--text-tertiary)]">
          Showing references on revision{' '}
          <span className="mono-2 text-[var(--text-secondary)]">{revision}</span>
          {driftCount > 0 && (
            <span className="ml-3 text-[var(--obs-drift-minor)]">{driftCount} with drift</span>
          )}
        </p>
      </div>

      <Card variant="dark" className="p-0 overflow-hidden">
        <div className="grid grid-cols-[180px_1fr_140px_140px_180px_140px] caption-1 uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-2 border-b border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)]">
          <span>Kind</span>
          <span>Resource</span>
          <span>Pinned</span>
          <span>Latest</span>
          <span>Last upgraded</span>
          <span></span>
        </div>
        <ul className="flex flex-col divide-y divide-[var(--surface-border)]">
          {links.map((l) => (
            <li
              key={`${l.resourceKind}-${l.resourceId}`}
              className="grid grid-cols-[180px_1fr_140px_140px_180px_140px] items-center px-4 py-3"
            >
              <span className="caption-1 text-[var(--text-secondary)] flex items-center gap-2">
                {KIND_LABEL[l.resourceKind]}
                <Badge variant="outline">{PIN_LABEL[l.resourceKind]}</Badge>
              </span>
              <Link
                href={resourceHref(l)}
                className="body-3 text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)]"
              >
                {l.resourceName ?? <span className="mono-2">{l.resourceId}</span>}
              </Link>
              <span className="mono-2 text-[var(--text-secondary)]">{l.pinnedVersion ?? '—'}</span>
              <span className="mono-2 text-[var(--text-secondary)]">{l.latestVersion ?? '—'}</span>
              <span className="caption-1 text-[var(--text-tertiary)]">
                {l.lastUpgradedAt ? new Date(l.lastUpgradedAt).toLocaleDateString() : '—'}
              </span>
              <div className="flex justify-end">
                {l.drift === 'none' ? (
                  <Badge variant="success">up-to-date</Badge>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setUpgrading(l)}>
                    Upgrade
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <UpgradeModal
        pipelineId={pipelineId}
        link={upgrading}
        onClose={() => setUpgrading(null)}
        onUpgraded={() => {
          setUpgrading(null)
          mutate()
        }}
      />
    </div>
  )
}

function resourceHref(l: LibraryLink): string {
  switch (l.resourceKind) {
    case 'kafka_connection':
      return `/library/connections/kafka/${l.resourceId}`
    case 'clickhouse_connection':
      return `/library/connections/clickhouse/${l.resourceId}`
    case 'schema':
      return `/library/schemas/${l.resourceId}`
    case 'transform':
      return `/library/transforms/${l.resourceId}`
  }
}
