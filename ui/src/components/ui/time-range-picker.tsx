'use client'

import { cn } from '@/src/utils/common.client'

export type TimeRangeKey = '15m' | '1h' | '6h' | '24h' | '7d' | 'custom'

export const DEFAULT_RANGES: Array<{ key: TimeRangeKey; label: string }> = [
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: 'custom', label: 'Custom' },
]

type TimeRangePickerProps = {
  value: TimeRangeKey
  onChange: (key: TimeRangeKey) => void
  ranges?: typeof DEFAULT_RANGES
  className?: string
}

export function TimeRangePicker({
  value,
  onChange,
  ranges = DEFAULT_RANGES,
  className,
}: TimeRangePickerProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-0.5',
        className,
      )}
      role="group"
      aria-label="Time range"
    >
      {ranges.map((r) => {
        const selected = r.key === value
        return (
          <button
            key={r.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(r.key)}
            className={cn(
              'px-2.5 py-1 rounded caption-1 transition-colors',
              selected
                ? 'bg-[var(--color-background-elevation-raised)] text-[var(--text-primary)] shadow-[var(--shadow-xs-dark)]'
                : 'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]',
            )}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
