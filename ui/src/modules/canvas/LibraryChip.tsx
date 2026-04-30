'use client'

import * as React from 'react'
import { LinkIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'

type LibraryChipKind = 'connection' | 'schema' | 'transform'

type LibraryChipProps = {
  kind: LibraryChipKind
  label: string // e.g. "OrderEvents"
  pinnedVersion?: string // e.g. "v1.4.0"
  hasDrift?: boolean // pinned ≠ latest
  onClick?: () => void
}

const KIND_LABEL: Record<LibraryChipKind, string> = {
  connection: 'conn',
  schema: 'schema',
  transform: 'transform',
}

export function LibraryChip({
  kind,
  label,
  pinnedVersion,
  hasDrift,
  onClick,
}: LibraryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded caption-1',
        'border bg-[var(--color-background-elevation-raised-faded)]',
        'hover:border-[var(--color-foreground-neutral-faded)] transition-colors',
        hasDrift
          ? 'border-[var(--obs-drift-minor)] text-[var(--obs-drift-minor)]'
          : 'border-[var(--surface-border)] text-[var(--text-secondary)]',
      )}
      title={
        hasDrift
          ? `${kind} ${label} ${pinnedVersion ?? ''} — newer version available`
          : `${kind} ${label} ${pinnedVersion ?? ''}`
      }
    >
      <LinkIcon size={10} aria-hidden="true" />
      <span className="caption-2 uppercase tracking-wider opacity-70">{KIND_LABEL[kind]}</span>
      <span className="mono-2">
        {label}
        {pinnedVersion ? `·${pinnedVersion}` : ''}
      </span>
    </button>
  )
}
