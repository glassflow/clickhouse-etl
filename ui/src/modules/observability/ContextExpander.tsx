'use client'

import { Button } from '@/src/components/ui/button'

type ContextExpanderProps = {
  collapsedCount: number
  onExpand: () => void
}

/**
 * Inline placeholder shown between non-adjacent log-line clusters when a
 * search is active. Click expands the gap to show all collapsed lines.
 */
export function ContextExpander({ collapsedCount, onExpand }: ContextExpanderProps) {
  return (
    <div className="flex items-center justify-center px-2 py-1.5 my-1 rounded-md bg-[var(--color-background-elevation-raised-faded)] border border-dashed border-[var(--surface-border)]">
      <Button
        variant="ghost"
        size="sm"
        onClick={onExpand}
        className="caption-1 text-[var(--text-tertiary)]"
      >
        · {collapsedCount} lines collapsed · click to expand ·
      </Button>
    </div>
  )
}
