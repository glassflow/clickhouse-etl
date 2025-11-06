'use client'

import React, { useState } from 'react'
import { toast as sonnerToast } from 'sonner'
import { Button } from '@/src/components/ui/button'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import type { NotificationOptions } from '../types'

const MAX_MESSAGE_LENGTH = 200 // Characters before truncation

// Helper function to parse error messages that might be JSON strings
function parseErrorMessage(message: string | undefined): string {
  if (!message) return ''
  
  // Try to parse as JSON if it looks like JSON
  if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(message)
      // Extract error message from common JSON error formats
      if (parsed.error) return parsed.error
      if (parsed.message) return parsed.message
      if (typeof parsed === 'string') return parsed
    } catch {
      // If parsing fails, return original message
    }
  }
  
  return message
}

// Custom toast component with improved layout
function CustomToast({
  title,
  description,
  action,
  reportLink,
  variant,
  onDismiss,
}: {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  reportLink?: string
  variant: 'success' | 'info' | 'warning' | 'error'
  onDismiss: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const parsedMessage = description ? parseErrorMessage(description) : ''
  const shouldTruncate = parsedMessage.length > MAX_MESSAGE_LENGTH
  const displayMessage = shouldTruncate && !isExpanded 
    ? parsedMessage.substring(0, MAX_MESSAGE_LENGTH) + '...'
    : parsedMessage

  return (
    <div className="flex flex-col gap-3 min-w-[320px] max-w-[500px]">
      {/* Header with title and close button */}
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold text-sm leading-tight pr-2">{title}</h4>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Error message / description */}
      {description && (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
            {displayMessage}
          </div>
          {shouldTruncate && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-primary hover:underline self-start"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* What to do section */}
      {action && (
        <div className="text-sm">
          <strong>What to do:</strong> {action.label}
        </div>
      )}

      {/* Report link section */}
      {reportLink && (
        <div className="text-sm text-muted-foreground">
          If the issue persists, please{' '}
          <a
            href={reportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            submit a report
          </a>{' '}
          so we can investigate.
        </div>
      )}

      {/* Action buttons footer */}
      {(action || reportLink) && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {action && (
            <Button
              onClick={() => {
                action.onClick()
                onDismiss()
              }}
              className="btn-primary h-8 text-xs"
              size="sm"
            >
              {action.label}
            </Button>
          )}
          <Button
            onClick={onDismiss}
            variant="outline"
            className="h-8 text-xs"
            size="sm"
          >
            Close
          </Button>
        </div>
      )}
    </div>
  )
}

export function showToast(options: NotificationOptions): string | number {
  const {
    variant,
    title,
    description,
    action,
    reportLink,
    duration = 5000,
  } = options

  // For simple toasts without action/reportLink, use default Sonner rendering
  if (!action && !reportLink) {
    const sonnerType =
      variant === 'error'
        ? 'error'
        : variant === 'warning'
          ? 'warning'
          : variant === 'success'
            ? 'success'
            : 'info'

    return sonnerToast[sonnerType](title, {
      description: description ? parseErrorMessage(description) : undefined,
      duration,
    })
  }

  // For complex toasts with actions/report links, use custom component
  return sonnerToast.custom(
    (t) => (
      <CustomToast
        title={title}
        description={description}
        action={action}
        reportLink={reportLink}
        variant={variant}
        onDismiss={() => sonnerToast.dismiss(t)}
      />
    ),
    {
      duration: duration,
    },
  )
}

