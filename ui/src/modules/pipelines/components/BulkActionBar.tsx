'use client'

import React from 'react'
import { Button } from '@/src/components/ui/button'

interface BulkActionBarProps {
  selectedCount: number
  totalVisible: number
  onStop: () => void
  onResume: () => void
  onTerminate: () => void
  onDelete: () => void
  onAddTag: () => void
  isLoading: boolean
}

export function BulkActionBar({
  selectedCount,
  totalVisible,
  onStop,
  onResume,
  onTerminate,
  onDelete,
  onAddTag,
  isLoading,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-[var(--surface-bg)] border border-[var(--surface-border)] flex-wrap">
      <span className="text-sm text-[var(--color-foreground-neutral)]">
        <span className="font-semibold">{selectedCount} selected</span>
        {' '}of {totalVisible} visible
      </span>

      <div className="flex-1" />

      <Button variant="ghost" size="sm" disabled={isLoading} onClick={onStop}>
        Stop
      </Button>
      <Button variant="ghost" size="sm" disabled={isLoading} onClick={onResume}>
        Resume
      </Button>
      <Button variant="ghost" size="sm" disabled={isLoading} onClick={onTerminate}>
        Terminate
      </Button>
      <Button variant="ghost" size="sm" disabled={isLoading} onClick={onAddTag}>
        Add tag
      </Button>
      <Button variant="destructive" size="sm" disabled={isLoading} onClick={onDelete}>
        Delete
      </Button>
    </div>
  )
}
