'use client'

import { X as XIcon } from 'lucide-react'
import { useStore } from '@/src/store'

export function BrushedRangePill() {
  const { observabilityStore } = useStore()
  const range = observabilityStore.brushedRange
  if (!range) return null

  const fmt = (ms: number) => new Date(ms).toLocaleTimeString()

  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--color-orange-alpha-10)] border border-[var(--color-foreground-primary-faded)] caption-1 text-[var(--color-foreground-primary)]">
      <span className="mono-2">
        pinned: {fmt(range.fromMs)} – {fmt(range.toMs)}
      </span>
      <span className="text-[var(--text-tertiary)]">
        · from {range.source.replace(/_/g, ' ')}
      </span>
      <button
        type="button"
        aria-label="Clear pinned range"
        onClick={() => observabilityStore.clearBrushedRange()}
        className="text-[var(--color-foreground-primary)] hover:opacity-80"
      >
        <XIcon size={12} />
      </button>
    </span>
  )
}
