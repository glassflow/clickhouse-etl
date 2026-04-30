'use client'

import * as React from 'react'
import { Button } from '@/src/components/ui/button'
import { cn } from '@/src/utils/common.client'

type EmptyStateProps = {
  icon?: React.ReactNode
  heading: string
  copy: string
  cta?: { label: string; onClick?: () => void; href?: string }
  codeSnippet?: string
  className?: string
}

export function EmptyState({ icon, heading, copy, cta, codeSnippet, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center gap-4 p-10',
        'rounded-lg border border-dashed border-[var(--surface-border)]',
        'bg-[var(--color-background-elevation-raised-faded)]',
        className,
      )}
    >
      {icon && (
        <div className="text-[var(--color-foreground-neutral-faded)]" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-w-md">
        <h3 className="title-6 text-[var(--text-primary)]">{heading}</h3>
        <p className="body-3 text-[var(--text-secondary)]">{copy}</p>
      </div>
      {codeSnippet && (
        <pre className="mono-2 px-3 py-2 rounded bg-[var(--color-background-elevation-base)] border border-[var(--surface-border)] text-[var(--color-foreground-neutral-faded)] max-w-full overflow-x-auto">
          <code>{codeSnippet}</code>
        </pre>
      )}
      {cta &&
        (cta.href ? (
          <Button variant="primary" size="sm" asChild>
            <a href={cta.href}>{cta.label}</a>
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={cta.onClick}>
            {cta.label}
          </Button>
        ))}
    </div>
  )
}
