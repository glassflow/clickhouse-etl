'use client'

import * as React from 'react'
import { Crumbs } from '@/src/components/ui/crumbs'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Skeleton } from '@/src/components/ui/skeleton'
import { EmptyState } from '@/src/components/ui/empty-state'
import { useTransform, useTransformVersions } from '@/src/hooks/useLibraryDetail'
import { TransformFormModal } from './TransformFormModal'

type TransformDetailProps = { id: string }

export function TransformDetail({ id }: TransformDetailProps) {
  const transform = useTransform(id)
  const versionsRes = useTransformVersions(id)
  const [editOpen, setEditOpen] = React.useState(false)

  if (transform.isLoading && !transform.data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton width={240} height={20} />
        <Skeleton width="100%" height={200} />
      </div>
    )
  }
  if (transform.error) {
    return (
      <EmptyState
        heading="Couldn't load transform"
        copy={String(transform.error)}
        cta={{ label: 'Retry', onClick: () => transform.mutate() }}
      />
    )
  }
  if (!transform.data) {
    return (
      <EmptyState
        heading="Transform not found"
        copy="This transform may have been deleted or you don't have access to it."
        cta={{ label: 'Back to Library', href: '/library' }}
      />
    )
  }

  const t = transform.data
  const versions = versionsRes.data

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <Crumbs
        crumbs={[
          { label: 'Library', href: '/library' },
          { label: 'Transforms', href: '/library' },
          { label: t.name },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="title-2 text-[var(--text-primary)]">{t.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t.language}</Badge>
            <Badge variant="outline">pinned per pipeline</Badge>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
      </div>

      <Card variant="dark" className="p-5">
        <h2 className="title-6 text-[var(--text-primary)] mb-3">Code</h2>
        <pre className="mono-1 rounded bg-[var(--color-background-elevation-base)] border border-[var(--surface-border)] p-3 text-[var(--color-foreground-neutral-faded)] overflow-x-auto whitespace-pre-wrap">
          {t.code}
        </pre>
      </Card>

      <Card variant="dark" className="p-5">
        <h2 className="title-6 text-[var(--text-primary)] mb-3">Versions</h2>
        {versionsRes.isLoading ? (
          <Skeleton width="100%" height={80} />
        ) : versionsRes.error ? (
          <EmptyState
            heading="Couldn't load versions"
            copy={String(versionsRes.error)}
            cta={{ label: 'Retry', onClick: () => versionsRes.mutate() }}
          />
        ) : versions.length === 0 ? (
          <EmptyState
            heading="No versions published yet"
            copy="Save the transform to publish version 1; subsequent edits create new versions automatically."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--surface-border)] border border-[var(--surface-border)] rounded-md">
            {versions.map((v) => (
              <li
                key={v.id}
                className="px-3 py-2 grid grid-cols-[120px_1fr_180px] items-center gap-3"
              >
                <span className="mono-1 text-[var(--text-primary)]">{v.version}</span>
                <span className="body-3 text-[var(--text-secondary)]">
                  {v.changeSummary ?? '—'}
                </span>
                <span className="mono-2 text-[var(--text-tertiary)] text-right">
                  {new Date(v.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <TransformFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          transform.mutate()
          versionsRes.mutate()
        }}
        transform={t}
      />
    </div>
  )
}
