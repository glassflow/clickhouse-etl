'use client'

import { Badge } from '@/src/components/ui/badge'

const ITEMS = [
  { id: 'M3', label: 'Metrics dashboard', status: 'shipped' as const },
  { id: 'M4', label: 'Logs live tail + search', status: 'shipped' as const },
  { id: 'M5', label: 'Tracing + profiles', status: 'planned' as const },
]

/**
 * Static roadmap list of the observability milestones. Surfaced on the
 * stack admin page so operators can see what's already on / coming.
 */
export function M3M4M5Roadmap() {
  return (
    <ul className="flex flex-col gap-2">
      {ITEMS.map((it) => (
        <li
          key={it.id}
          className="flex items-center justify-between px-3 py-2 rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)]"
        >
          <span className="body-3 text-[var(--text-primary)]">
            <span className="mono-2 mr-2 text-[var(--text-tertiary)]">{it.id}</span>
            {it.label}
          </span>
          <Badge variant={it.status === 'shipped' ? 'success' : 'outline'}>
            {it.status}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
