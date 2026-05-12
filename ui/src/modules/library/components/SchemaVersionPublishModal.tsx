'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Textarea } from '@/src/components/ui/textarea'
import { computeNextSemver, type SemverBump } from '@/src/app/ui-api/library/schemas/[id]/versions/semver-util'
import type { SchemaField } from './SchemaDiffViewer'

type SchemaVersionPublishModalProps = {
  open: boolean
  latestVersion: string | null
  currentFields: SchemaField[]
  onClose: () => void
  onPublish: (data: { bump: SemverBump; changeSummary: string | undefined; fields: SchemaField[] }) => Promise<void>
}

export function SchemaVersionPublishModal({
  open,
  latestVersion,
  currentFields,
  onClose,
  onPublish,
}: SchemaVersionPublishModalProps) {
  const [bump, setBump] = React.useState<SemverBump>('minor')
  const [summary, setSummary] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const nextVersion = React.useMemo(() => computeNextSemver(latestVersion, bump), [latestVersion, bump])

  // Reset form on open
  React.useEffect(() => {
    if (open) {
      setBump('minor')
      setSummary('')
    }
  }, [open])

  const handlePublish = async () => {
    setSubmitting(true)
    try {
      await onPublish({
        bump,
        changeSummary: summary.trim() || undefined,
        fields: currentFields,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="modal-title title-4 text-[var(--text-primary)]">Publish new version</DialogTitle>
          <DialogDescription className="modal-description">
            Pinned pipelines stay on their current version. Owners must explicitly upgrade.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="body-3 font-medium text-[var(--color-foreground-neutral-faded)] mb-2">Bump</legend>
            {(['major', 'minor', 'patch'] as SemverBump[]).map((b) => (
              <label
                key={b}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--interactive-hover-bg)]"
              >
                <input
                  type="radio"
                  name="bump"
                  value={b}
                  checked={bump === b}
                  onChange={() => setBump(b)}
                  aria-label={b.charAt(0).toUpperCase() + b.slice(1)}
                />
                <span className="body-3 capitalize text-[var(--text-primary)]">{b}</span>
                <span className="caption-1 text-[var(--text-tertiary)]">
                  {b === 'major' && 'Breaking changes (incompatible field removals/renames)'}
                  {b === 'minor' && 'Backwards-compatible additions (new optional fields)'}
                  {b === 'patch' && 'Documentation, descriptions, no field changes'}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex items-center justify-between rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] px-3 py-2">
            <span className="caption-1 text-[var(--text-tertiary)]">Next version</span>
            <span className="mono-1 text-[var(--color-foreground-primary)]">{nextVersion}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="change-summary" className="body-3 font-medium text-[var(--color-foreground-neutral-faded)]">
              Change summary
            </label>
            <Textarea
              id="change-summary"
              placeholder="What changed in this version?"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handlePublish} loading={submitting} loadingText="Publishing…">
            Publish {nextVersion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
