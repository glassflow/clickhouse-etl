import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { Crumbs, type Crumb } from '@/src/components/ui/crumbs'
import { cn } from '@/src/utils/common.client'

const pageShellVariants = cva('page-shell', {
  variants: {
    density: {
      comfortable: 'page-shell-comfortable',
      compact: 'page-shell-compact',
    },
  },
  defaultVariants: {
    density: 'comfortable',
  },
})

export interface PageShellProps extends VariantProps<typeof pageShellVariants> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  crumbs?: Crumb[]
  actions?: React.ReactNode
  filters?: React.ReactNode
  sidebar?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Heading level for the title. Defaults to `h1`. */
  titleAs?: 'h1' | 'h2'
  /** Slot for live status (e.g. healthy / incident banner) below the subtitle. */
  status?: React.ReactNode
}

export function PageShell({
  title,
  subtitle,
  crumbs,
  actions,
  filters,
  sidebar,
  children,
  className,
  density,
  titleAs: TitleTag = 'h1',
  status,
}: PageShellProps) {
  const body = <main className="page-shell-body">{children}</main>

  return (
    <div className={cn(pageShellVariants({ density }), className)}>
      {crumbs && crumbs.length > 0 && (
        <div className="page-shell-crumbs">
          <Crumbs crumbs={crumbs} />
        </div>
      )}

      <header className="page-shell-header">
        <div className="page-shell-header-text">
          <TitleTag className="page-shell-title">{title}</TitleTag>
          {subtitle && <p className="page-shell-subtitle">{subtitle}</p>}
          {status && <div className="page-shell-status">{status}</div>}
        </div>
        {actions && <div className="page-shell-actions">{actions}</div>}
      </header>

      {filters && <div className="page-shell-filters">{filters}</div>}

      {sidebar ? (
        <div className="page-shell-layout">
          <aside className="page-shell-sidebar" aria-label="Sidebar navigation">
            {sidebar}
          </aside>
          {body}
        </div>
      ) : (
        body
      )}
    </div>
  )
}

PageShell.displayName = 'PageShell'

export { pageShellVariants }
