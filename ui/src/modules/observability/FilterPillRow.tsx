'use client'

import { Pill } from '@/src/components/ui/pill'

type FilterPillRowProps<K extends string> = {
  label: string
  options: K[]
  counts: Record<K, number>
  selected: K[]
  onToggle: (key: K) => void
  swatchColors?: Partial<Record<K, string>>
}

/**
 * Row of toggleable filter pills with counts.
 *
 * Used by LogsTab for severity + component facets. Each pill emits a
 * single-key toggle event; the parent owns the selection state.
 */
export function FilterPillRow<K extends string>({
  label,
  options,
  counts,
  selected,
  onToggle,
  swatchColors,
}: FilterPillRowProps<K>) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="caption-1 text-[var(--text-tertiary)] uppercase tracking-wider">
        {label}
      </span>
      {options.map((opt) => (
        <Pill
          key={opt}
          count={counts[opt] ?? 0}
          swatchColor={swatchColors?.[opt]}
          selected={selected.includes(opt)}
          onSelect={() => onToggle(opt)}
        >
          {opt}
        </Pill>
      ))}
    </div>
  )
}
