'use client'

import React from 'react'
import { Button } from '@/src/components/ui/button'
import type { NotificationOptions } from '../types'

export function InlineAlert({ options }: { options: NotificationOptions }): React.ReactElement {
  const { title, description, action, reportLink } = options

  return (
    <div className="flex flex-col min-w-[320px] max-w-[500px] bg-[var(--color-background-elevation-raised-faded-2)] surface-gradient-border rounded-md shadow-lg">
      {/* Header with title */}
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <h4 className="font-semibold text-lg leading-none pr-2 text-[var(--color-foreground-neutral)]">{title}</h4>
      </div>

      {/* Content section with borders */}
      {(description || action || reportLink) && (
        <div className="px-4 pb-4 border-[var(--color-border-neutral)]">
          {/* Description */}
          {description && (
            <div className="flex flex-col gap-2 pt-4">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                {description}
              </div>
            </div>
          )}

          {/* What to do section */}
          {action && (
            <div className="text-sm pt-2">
              <strong>What to do:</strong> {action.label}
            </div>
          )}

          {/* Report link section */}
          {reportLink && (
            <div className="text-sm text-muted-foreground pt-2">
              If the issue persists, please{' '}
              <a
                href={reportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline text-[var(--color-foreground-primary)]"
              >
                submit a report
              </a>{' '}
              so we can investigate.
            </div>
          )}
        </div>
      )}

      {/* Action buttons footer */}
      {(action || reportLink) && (
        <div className="flex items-center justify-end gap-2.5 px-4 py-4 border-[var(--color-border-neutral)]">
          {action && (
            <Button onClick={action.onClick} variant="primary" size="custom">
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
