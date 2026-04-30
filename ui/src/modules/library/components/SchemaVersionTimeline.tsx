'use client'

import * as React from 'react'
import type { SchemaVersion } from '@/src/hooks/useLibraryDetail'
import { cn } from '@/src/utils/common.client'

type Slot = 'a' | 'b'

type SchemaVersionTimelineProps = {
  versions: SchemaVersion[]
  selectedA: string | null
  selectedB: string | null
  onSelect: (slot: Slot, versionId: string) => void
  className?: string
}

export function SchemaVersionTimeline({
  versions,
  selectedA,
  selectedB,
  onSelect,
  className,
}: SchemaVersionTimelineProps) {
  // Two-slot toggle: first click sets a, second click sets b. Subsequent clicks
  // shift the older selection out (b ← a, a ← new).
  const handleClick = (id: string) => {
    if (selectedA === id || selectedB === id) {
      // already selected — clear it; treat as toggle off
      if (selectedA === id) onSelect('a', '')
      else onSelect('b', '')
      return
    }
    if (!selectedA) onSelect('a', id)
    else if (!selectedB) onSelect('b', id)
    else {
      // shift: b ← a, a ← new
      onSelect('b', selectedA)
      onSelect('a', id)
    }
  }

  return (
    <ol className={cn('flex flex-col gap-0', className)} aria-label="Version timeline">
      {versions.map((v, i) => {
        const isFirst = i === 0
        const isLast = i === versions.length - 1
        const slot: Slot | null =
          selectedA === v.id ? 'a' : selectedB === v.id ? 'b' : null
        const selected = slot !== null

        return (
          <li key={v.id} className="grid grid-cols-[24px_1fr] gap-2">
            {/* Rail */}
            <div className="relative flex justify-center">
              {!isFirst && (
                <div className="absolute top-0 bottom-1/2 w-px bg-[var(--surface-border)]" />
              )}
              <div
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full',
                  selected
                    ? 'bg-[var(--color-foreground-primary)]'
                    : 'bg-[var(--color-foreground-neutral-faded)]',
                )}
              />
              {!isLast && (
                <div className="absolute top-1/2 bottom-0 w-px bg-[var(--surface-border)]" />
              )}
            </div>

            {/* Card */}
            <button
              type="button"
              aria-pressed={selected}
              aria-label={`Select ${v.version}`}
              onClick={() => handleClick(v.id)}
              className={cn(
                'flex items-start gap-3 px-3 py-2 my-1 rounded-md text-left transition-colors',
                'border',
                selected
                  ? 'border-[var(--color-foreground-primary)] bg-[var(--color-orange-alpha-10)]'
                  : 'border-[var(--surface-border)] hover:border-[var(--color-foreground-neutral-faded)]',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="mono-1 text-[var(--text-primary)]">{v.version}</span>
                  {slot && (
                    <span className="caption-2 px-1 rounded bg-[var(--color-foreground-primary)] text-[var(--color-on-background-primary)]">
                      {slot.toUpperCase()}
                    </span>
                  )}
                </div>
                {v.changeSummary && (
                  <p className="body-3 text-[var(--text-secondary)] mt-0.5">{v.changeSummary}</p>
                )}
                <p className="caption-1 text-[var(--text-tertiary)] mt-1">
                  {v.createdBy ? `${v.createdBy} · ` : ''}
                  <span className="mono-2">{new Date(v.createdAt).toLocaleString()}</span>
                </p>
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
