'use client'

import * as React from 'react'
import { cn } from '@/src/utils/common.client'

type PaletteItemProps = {
  kind: string
  label: string
  description: string
  icon: React.ReactNode
}

export function PaletteItem({ kind, label, description, icon }: PaletteItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/glassflow-node-kind', kind)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      data-palette-item
      data-kind={kind}
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'group flex items-start gap-2.5 px-3 py-2.5 rounded-md cursor-grab active:cursor-grabbing',
        'border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)]',
        'hover:border-[var(--color-foreground-neutral-faded)] hover:bg-[var(--color-background-elevation-raised)] transition-colors',
      )}
    >
      <span
        className="mt-0.5 text-[var(--color-foreground-neutral-faded)] group-hover:text-[var(--color-foreground-primary)]"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="body-3 text-[var(--text-primary)]">{label}</span>
        <span className="caption-1 text-[var(--text-tertiary)] truncate">{description}</span>
      </div>
    </div>
  )
}
