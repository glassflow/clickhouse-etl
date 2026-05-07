'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'

interface BulkTagModalProps {
  visible: boolean
  selectedCount: number
  onAddTags: (tags: string[]) => void
  onCancel: () => void
  isLoading: boolean
}

export function BulkTagModal({
  visible,
  selectedCount,
  onAddTags,
  onCancel,
  isLoading,
}: BulkTagModalProps) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    const tags = input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    if (tags.length === 0) return
    onAddTags(tags)
    setInput('')
  }

  const handleCancel = () => {
    setInput('')
    onCancel()
  }

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) handleCancel() }}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0">
        <DialogTitle className="modal-title">Add Tags</DialogTitle>
        <DialogDescription className="modal-description">
          Adding tags to {selectedCount} pipeline{selectedCount !== 1 ? 's' : ''}. Separate multiple tags with commas.
        </DialogDescription>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Enter tag(s)…"
          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--color-foreground-neutral)] placeholder:text-[var(--control-fg-placeholder)] focus:outline-none focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)] mt-4"
        />

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={isLoading || !input.trim()}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
