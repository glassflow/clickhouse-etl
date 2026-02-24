'use client'

import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import type { NotificationOptions } from '../types'

interface BannerProps {
  options: NotificationOptions
  onDismiss: () => void
}

export function Banner({ options, onDismiss }: BannerProps) {
  const { title, description, action, reportLink, documentationLink } = options

  return (
    <div className="flex flex-col min-w-[320px] max-w-[500px] bg-[var(--color-background-elevation-raised-faded-2)] surface-gradient-border rounded-md shadow-lg">
      {/* Header with title and close button */}
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <h4 className="font-semibold text-lg leading-none pr-2 text-[var(--color-foreground-neutral)]">{title}</h4>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none text-[var(--color-foreground-neutral)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content section with borders */}
      {(description || action || reportLink || documentationLink) && (
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

          {/* Documentation link section */}
          {documentationLink && (
            <div className="text-sm text-muted-foreground pt-2">
              For more information, please see the{' '}
              <a
                href={documentationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline text-[var(--color-foreground-primary)]"
              >
                documentation
              </a>
              .
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
            <Button
              onClick={() => {
                action.onClick()
                onDismiss()
              }}
              variant="primary"
            >
              {action.label}
            </Button>
          )}
          <Button onClick={onDismiss} variant="tertiary">
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
