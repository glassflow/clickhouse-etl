'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/src/utils/common.client'

type Tab = {
  href: string
  label: string
  badge?: { count?: number; tone?: 'warn' | 'error' | 'info' }
}

type PipelineTabsProps = {
  pipelineId: string
  tabs?: Tab[]
}

const DEFAULT_TABS: (id: string) => Tab[] = (id) => [
  { href: `/pipelines/${id}/overview`, label: 'Overview' },
  { href: `/pipelines/${id}/canvas`, label: 'Canvas' },
  { href: `/pipelines/${id}/library-links`, label: 'Library links' },
  { href: `/pipelines/${id}/metrics`, label: 'Metrics' },
  { href: `/pipelines/${id}/logs`, label: 'Logs' },
  { href: `/pipelines/${id}/settings`, label: 'Settings' },
]

export function PipelineTabs({ pipelineId, tabs }: PipelineTabsProps) {
  const pathname = usePathname()
  const items = tabs ?? DEFAULT_TABS(pipelineId)

  return (
    <nav
      role="tablist"
      aria-label="Pipeline sections"
      className="flex items-end gap-1 border-b border-[var(--surface-border)] -mb-px"
    >
      {items.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 body-3 transition-colors border-b-2 -mb-px',
              active
                ? 'border-[var(--color-foreground-primary)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]',
            )}
          >
            {tab.label}
            {tab.badge?.count != null && (
              <span
                className={cn(
                  'caption-2 px-1.5 py-0.5 rounded-full',
                  tab.badge.tone === 'error' &&
                    'bg-[var(--color-background-critical-faded)] text-[var(--color-foreground-critical)]',
                  tab.badge.tone === 'warn' &&
                    'bg-[var(--color-background-warning-faded)] text-[var(--color-foreground-warning)]',
                  (tab.badge.tone === 'info' || !tab.badge.tone) &&
                    'bg-[var(--color-background-elevation-raised)] text-[var(--color-foreground-neutral-faded)]',
                )}
              >
                {tab.badge.count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
