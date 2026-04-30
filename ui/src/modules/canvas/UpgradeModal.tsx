'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { SchemaDiffViewer, type SchemaField } from '@/src/modules/library/components/SchemaDiffViewer'
import type { LibraryLink } from '@/src/hooks/useLibraryLinks'
import { notify } from '@/src/notifications'

type UpgradeModalProps = {
  pipelineId: string
  link: LibraryLink | null
  onClose: () => void
  onUpgraded: () => void
}

type SchemaVersionDetail = {
  id: string
  schemaId: string
  version: string
  fields: SchemaField[]
  changeSummary: string | null
  createdAt: string
}

/**
 * Upgrade a single resource pin on a pipeline. Renders a schema diff
 * (pinned vs latest) when the resource is a schema, or a short text
 * note for transforms. Confirming creates a new pipeline_revisions row
 * via POST /ui-api/pipelines/:id/revisions with the same config but a
 * patched references list — only the targeted resource's pinnedVersion
 * is bumped.
 */
export function UpgradeModal({ pipelineId, link, onClose, onUpgraded }: UpgradeModalProps) {
  const open = link !== null
  const [submitting, setSubmitting] = React.useState(false)
  const [pinnedDetail, setPinnedDetail] = React.useState<SchemaVersionDetail | null>(null)
  const [latestDetail, setLatestDetail] = React.useState<SchemaVersionDetail | null>(null)
  const [diffLoading, setDiffLoading] = React.useState(false)

  // Fetch pinned + latest version detail when a schema upgrade is being shown.
  React.useEffect(() => {
    if (
      !open ||
      !link ||
      link.resourceKind !== 'schema' ||
      !link.pinnedVersion ||
      !link.latestVersion
    ) {
      setPinnedDetail(null)
      setLatestDetail(null)
      return
    }
    let cancelled = false
    setDiffLoading(true)
    Promise.all([
      fetch(`/ui-api/library/schemas/${link.resourceId}/versions/${link.pinnedVersion}`).then(
        (r) => (r.ok ? (r.json() as Promise<SchemaVersionDetail>) : null),
      ),
      fetch(`/ui-api/library/schemas/${link.resourceId}/versions/${link.latestVersion}`).then(
        (r) => (r.ok ? (r.json() as Promise<SchemaVersionDetail>) : null),
      ),
    ])
      .then(([pinned, latest]) => {
        if (cancelled) return
        setPinnedDetail(pinned)
        setLatestDetail(latest)
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, link])

  const handleUpgrade = async () => {
    if (!link) return
    setSubmitting(true)
    try {
      const linksRes = await fetch(`/ui-api/pipelines/${pipelineId}/library-links`).then((r) =>
        r.json(),
      )
      const allLinks: LibraryLink[] = linksRes.links ?? []

      const newReferences = allLinks.map((l) => ({
        resourceKind: l.resourceKind,
        resourceId: l.resourceId,
        pinnedVersion:
          l.resourceKind === link.resourceKind && l.resourceId === link.resourceId
            ? link.latestVersion
            : l.pinnedVersion,
      }))

      // Re-use the latest revision's config snapshot — the bump pins a new
      // resource version; the canvas topology itself is unchanged.
      const latestRevs = (await fetch(`/ui-api/pipelines/${pipelineId}/revisions`).then((r) =>
        r.json(),
      )) as Array<{ env: string; config: Record<string, unknown> }>
      const baseConfig = latestRevs?.[0]?.config ?? {}
      const env = latestRevs?.[0]?.env ?? 'production'

      const res = await fetch(`/ui-api/pipelines/${pipelineId}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ env, config: baseConfig, references: newReferences }),
      })
      if (!res.ok) {
        notify({ variant: 'error', title: 'Upgrade failed' })
        return
      }
      const json = (await res.json()) as { revision?: number }
      notify({ variant: 'success', title: `Revision ${json.revision} deployed` })
      onUpgraded()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      notify({ variant: 'error', title: 'Upgrade failed', description: message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPortal>
        <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
        <DialogContent className="info-modal-container surface-gradient-border border-0 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="modal-title">
              Upgrade {link?.resourceName ?? link?.resourceId}{' '}
              <span className="mono-2 text-[var(--text-tertiary)]">
                {link?.pinnedVersion ?? '—'} → {link?.latestVersion ?? '—'}
              </span>
            </DialogTitle>
            <DialogDescription className="modal-description">
              A new pipeline revision will be deployed with this resource pinned to its latest
              version.
            </DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              {link && link.drift !== 'none' && (
                <Badge variant={link.drift === 'major' ? 'error' : 'warning'}>
                  {link.drift} drift
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="py-3">
            {link?.resourceKind === 'schema' ? (
              diffLoading ? (
                <p className="body-3 text-[var(--text-secondary)] animate-pulse">Loading diff…</p>
              ) : pinnedDetail && latestDetail ? (
                <SchemaDiffViewer
                  oldVersion={{ version: pinnedDetail.version, fields: pinnedDetail.fields }}
                  newVersion={{ version: latestDetail.version, fields: latestDetail.fields }}
                />
              ) : (
                <p className="body-3 text-[var(--text-secondary)]">
                  Could not load version detail. Continue to deploy a new revision pinning the
                  schema to {link.latestVersion}.
                </p>
              )
            ) : link?.resourceKind === 'transform' ? (
              <p className="body-3 text-[var(--text-secondary)]">
                Transform code will move from{' '}
                <span className="mono-2">{link.pinnedVersion ?? '—'}</span> to{' '}
                <span className="mono-2">{link.latestVersion ?? '—'}</span>. View the full diff on
                the transform&rsquo;s detail page.
              </p>
            ) : (
              <p className="body-3 text-[var(--text-secondary)]">
                Connections are live across all pipelines and don&rsquo;t need a per-revision
                upgrade.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleUpgrade()}
              loading={submitting}
              loadingText="Deploying…"
              disabled={!link || link.drift === 'none'}
            >
              Deploy new revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
