import * as React from 'react'
import Link from 'next/link'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'

export type Crumb = { label: string; href?: string }

type CrumbsProps = {
  crumbs: Crumb[]
  className?: string
}

export function Crumbs({ crumbs, className }: CrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 caption-1', className)}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <React.Fragment key={i}>
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)] transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={isLast ? 'text-[var(--text-primary)]' : 'text-[var(--color-foreground-neutral-faded)]'}
                aria-current={isLast ? 'page' : undefined}
              >
                {crumb.label}
              </span>
            )}
            {!isLast && (
              <ChevronRightIcon
                size={12}
                className="text-[var(--color-foreground-neutral-faded)]"
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
