'use client'

import * as React from 'react'
import { cn } from '@/src/utils/common.client'

type PillProps = {
  children: React.ReactNode
  count?: number
  swatchColor?: string
  selected?: boolean
  onSelect?: () => void
  className?: string
}

export function Pill({ children, count, swatchColor, selected, onSelect, className }: PillProps) {
  const interactive = Boolean(onSelect)

  const Tag = interactive ? 'button' : 'span'
  const interactiveProps = interactive
    ? { type: 'button' as const, onClick: onSelect, 'aria-pressed': selected ?? false }
    : {}

  return (
    <Tag
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border caption-1 transition-colors',
        selected
          ? 'bg-[var(--color-orange-alpha-20)] border-[var(--color-foreground-primary)] text-[var(--color-foreground-primary)]'
          : 'bg-[var(--color-background-elevation-raised-faded)] border-[var(--surface-border)] text-[var(--color-foreground-neutral-faded)]',
        interactive && 'cursor-pointer hover:border-[var(--color-foreground-neutral-faded)]',
        className,
      )}
      {...interactiveProps}
    >
      {swatchColor && (
        <span
          data-pill-swatch
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ backgroundColor: swatchColor }}
        />
      )}
      <span>{children}</span>
      {typeof count === 'number' && (
        <span className="mono-2 text-[var(--color-foreground-neutral-faded)]">{count}</span>
      )}
    </Tag>
  )
}
