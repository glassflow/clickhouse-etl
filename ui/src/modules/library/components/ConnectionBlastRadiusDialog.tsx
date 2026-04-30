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
import { Checkbox } from '@/src/components/ui/checkbox'
import { AlertTriangleIcon } from 'lucide-react'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

type ConnectionBlastRadiusDialogProps = {
  open: boolean
  usedBy: UsedByEntry[]
  onCancel: () => void
  onConfirm: () => void
}

export function ConnectionBlastRadiusDialog({
  open,
  usedBy,
  onCancel,
  onConfirm,
}: ConnectionBlastRadiusDialogProps) {
  const [acknowledged, setAcknowledged] = React.useState(false)

  React.useEffect(() => {
    if (open) setAcknowledged(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="modal-title title-4 text-[var(--text-primary)] flex items-center gap-2">
            <AlertTriangleIcon
              className="text-[var(--color-foreground-warning)]"
              size={18}
              aria-hidden="true"
            />
            Live change — {usedBy.length} pipeline{usedBy.length === 1 ? '' : 's'} affected
          </DialogTitle>
          <DialogDescription className="modal-description">
            Connections aren&apos;t versioned. Saving updates every pipeline immediately,
            including running production deploys.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          <p className="caption-1 text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Will apply to
          </p>
          <ul className="flex flex-col divide-y divide-[var(--surface-border)] rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] max-h-60 overflow-y-auto">
            {usedBy.map((p) => (
              <li
                key={p.pipelineId}
                className="px-3 py-2 body-3 text-[var(--text-primary)]"
              >
                {p.pipelineName}{' '}
                <span className="mono-2 text-[var(--text-tertiary)]">({p.pipelineId})</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-start gap-2 px-1 py-2 cursor-pointer">
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
            aria-label="I understand this is a live change"
          />
          <span className="body-3 text-[var(--text-primary)]">
            I understand this is a live change to {usedBy.length} pipeline
            {usedBy.length === 1 ? '' : 's'}.
          </span>
        </label>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!acknowledged}
            onClick={onConfirm}
          >
            Save and apply live
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
