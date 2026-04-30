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
import { Checkbox } from '@/src/components/ui/checkbox'
import { useSchemaUsedBy } from '@/src/hooks/useLibraryDetail'
import { notify } from '@/src/notifications'

type BulkRolloutModalProps = {
  open: boolean
  schemaId: string
  toVersion: string
  onClose: () => void
}

/**
 * Bulk-roll a schema to a target version across multiple pipelines that
 * already reference it.
 *
 * Targets are seeded from useSchemaUsedBy: any pipeline already on `toVersion`
 * is shown but disabled. Mode picker controls atomic vs staged rollout (see
 * the rollout route for semantics). Confirmation POSTs once and reads back
 * a per-pipeline success/error map for the toast wording.
 */
export function BulkRolloutModal({
  open,
  schemaId,
  toVersion,
  onClose,
}: BulkRolloutModalProps) {
  const usedBy = useSchemaUsedBy(open ? schemaId : null)
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [mode, setMode] = React.useState<'atomic' | 'staged'>('atomic')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      const next: Record<string, boolean> = {}
      for (const p of usedBy.data) {
        next[p.pipelineId] = (p.pinnedVersion ?? '') !== toVersion
      }
      setSelected(next)
    }
  }, [open, usedBy.data, toVersion])

  const targets = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/ui-api/library/schemas/${schemaId}/rollout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetPipelineIds: targets, toVersion, mode }),
      })
      if (!res.ok) {
        notify({ variant: 'error', title: 'Rollout failed' })
        return
      }
      const json = (await res.json()) as { succeeded: number; total: number }
      notify({
        variant: json.succeeded === json.total ? 'success' : 'warning',
        title: `Rolled out to ${json.succeeded}/${json.total} pipelines`,
      })
      onClose()
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Rollout failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPortal>
        <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
        <DialogContent className="info-modal-container surface-gradient-border border-0 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="modal-title">
              Bulk roll out to <span className="mono-2">{toVersion}</span>
            </DialogTitle>
            <DialogDescription className="modal-description">
              Each selected pipeline gets a new revision pinning this schema to {toVersion}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            {usedBy.isLoading ? (
              <p className="body-3 text-[var(--text-secondary)] animate-pulse">Loading…</p>
            ) : usedBy.data.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">
                No pipelines reference this schema.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--surface-border)] rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] max-h-72 overflow-y-auto">
                {usedBy.data.map((p) => {
                  const onTarget = (p.pinnedVersion ?? '') === toVersion
                  return (
                    <li
                      key={p.pipelineId}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <Checkbox
                          checked={selected[p.pipelineId] ?? false}
                          disabled={onTarget}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({
                              ...s,
                              [p.pipelineId]: v === true,
                            }))
                          }
                        />
                        <span className="body-3 text-[var(--text-primary)]">
                          {p.pipelineName}
                        </span>
                      </label>
                      <span className="mono-2 text-[var(--text-tertiary)]">
                        pinned: {p.pinnedVersion ?? 'live'}{' '}
                        {onTarget && '· already on target'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <fieldset className="flex items-center gap-4 px-1 py-2">
            <legend className="caption-1 text-[var(--text-tertiary)] uppercase tracking-wider mr-2">
              Mode
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="atomic"
                checked={mode === 'atomic'}
                onChange={() => setMode('atomic')}
              />
              <span className="body-3 text-[var(--text-primary)]">Atomic</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="staged"
                checked={mode === 'staged'}
                onChange={() => setMode('staged')}
              />
              <span className="body-3 text-[var(--text-primary)]">Staged (500ms gap)</span>
            </label>
          </fieldset>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={targets.length === 0}
              loading={submitting}
              loadingText="Rolling out…"
              onClick={() => void handleConfirm()}
            >
              Roll out to {targets.length} pipeline{targets.length === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
