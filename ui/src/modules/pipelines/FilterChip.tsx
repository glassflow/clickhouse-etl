'use client'

import React from 'react'
import { cn } from '@/src/utils/common.client'

interface FilterChipProps {
  label: string
  values: string[]
  onRemove: () => void
  onClick?: () => void
  className?: string
}

export function FilterChip({ label, values, onRemove, onClick, className }: FilterChipProps) {
  if (values.length === 0) return null

  const displayText = `${label}: ${values.join(', ')}`

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-[var(--color-background-elevation-raised-faded)] text-[var(--color-foreground-neutral)] text-sm font-medium',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:opacity-90',
        className,
      )}
      onClick={onClick}
      style={{
        backgroundColor: 'var(--color-background-elevation-raised-faded)',
        color: 'var(--color-foreground-neutral)',
      }}
    >
      <span>{displayText}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="ml-1 hover:opacity-70 rounded p-0.5 transition-opacity duration-200"
        aria-label="Remove filter"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
