'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/src/components/ui/dialog'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'

type CustomDateRangeModalProps = {
  open: boolean
  initialFrom?: Date | null
  initialTo?: Date | null
  onClose: () => void
  onApply: (range: { fromMs: number; toMs: number }) => void
}

/**
 * Modal for selecting an absolute "from / to" range when the user picks
 * 'custom' on the time-range picker. Stores values as datetime-local
 * (browser-supplied widget) and converts to epoch ms on Apply.
 */
export function CustomDateRangeModal({ open, initialFrom, initialTo, onClose, onApply }: CustomDateRangeModalProps) {
  const [from, setFrom] = React.useState(() => toLocalIso(initialFrom ?? new Date(Date.now() - 60 * 60 * 1000)))
  const [to, setTo] = React.useState(() => toLocalIso(initialTo ?? new Date()))
  const [error, setError] = React.useState<string | null>(null)

  // Re-seed when the modal is re-opened so the inputs reflect the current
  // store value rather than the stale state from the previous mount.
  React.useEffect(() => {
    if (!open) return
    setFrom(toLocalIso(initialFrom ?? new Date(Date.now() - 60 * 60 * 1000)))
    setTo(toLocalIso(initialTo ?? new Date()))
    setError(null)
  }, [open, initialFrom, initialTo])

  const handleApply = () => {
    const fromMs = new Date(from).getTime()
    const toMs = new Date(to).getTime()
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      setError('Both dates are required.')
      return
    }
    if (fromMs >= toMs) {
      setError('"From" must be earlier than "To".')
      return
    }
    onApply({ fromMs, toMs })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPortal>
        <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
        <DialogContent className="info-modal-container surface-gradient-border border-0 max-w-md">
          <DialogHeader>
            <DialogTitle className="modal-title">Custom range</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="custom-range-from"
                className="body-3 font-medium text-[var(--color-foreground-neutral-faded)]"
              >
                From
              </label>
              <Input
                id="custom-range-from"
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="custom-range-to"
                className="body-3 font-medium text-[var(--color-foreground-neutral-faded)]"
              >
                To
              </label>
              <Input id="custom-range-to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {error && (
            <div className="caption-1 text-[var(--color-foreground-critical)]" role="alert" aria-live="polite">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleApply}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

/**
 * Format a Date as a `YYYY-MM-DDTHH:mm` string suitable for a
 * `<input type="datetime-local">` widget (which expects local time, not UTC).
 */
function toLocalIso(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}
