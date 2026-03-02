'use client'

import { useState } from 'react'
import Link from 'next/link'
import { structuredLogger } from '@/src/observability'
import { Check, Trash2, AlertCircle, AlertTriangle, Info, XCircle, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import { Button } from '@/src/components/ui/button'
import type { Notification, NotificationSeverity } from '@/src/services/notifications-api'

interface NotificationItemProps {
  notification: Notification
  isSelected: boolean
  onSelect: () => void
  onMarkAsRead: () => void
  onDelete: () => void
  onClosePanel?: () => void
}

/**
 * Severity configuration with semantic color variables
 */
const SEVERITY_CONFIG: Record<
  NotificationSeverity,
  { icon: typeof AlertCircle; colorVar: string; borderColorVar: string; bgColorVar: string }
> = {
  critical: {
    icon: XCircle,
    colorVar: 'var(--color-foreground-critical)',
    borderColorVar: 'var(--color-border-critical)',
    bgColorVar: 'var(--color-background-critical-faded)',
  },
  error: {
    icon: AlertCircle,
    colorVar: 'var(--color-foreground-critical)',
    borderColorVar: 'var(--color-border-critical-faded)',
    bgColorVar: 'var(--color-background-critical-faded)',
  },
  warning: {
    icon: AlertTriangle,
    colorVar: 'var(--color-foreground-warning)',
    borderColorVar: 'var(--color-border-warning)',
    bgColorVar: 'var(--color-background-warning-faded)',
  },
  info: {
    icon: Info,
    colorVar: 'var(--color-foreground-info)',
    borderColorVar: 'var(--color-border-info)',
    bgColorVar: 'var(--color-background-info-faded)',
  },
}

/**
 * Format the notification timestamp as relative time
 */
const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return 'just now'
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return `${diffInHours}h ago`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
      return `${diffInDays}d ago`
    }

    const diffInWeeks = Math.floor(diffInDays / 7)
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`
    }

    // For older dates, show the actual date
    return date.toLocaleDateString()
  } catch {
    return 'Unknown time'
  }
}

/**
 * NotificationItem Component
 *
 * Displays a single notification with actions for marking as read and deleting.
 */
export function NotificationItem({
  notification,
  isSelected,
  onSelect,
  onMarkAsRead,
  onDelete,
  onClosePanel,
}: NotificationItemProps) {
  const { notification_id, title, message, severity, timestamp, read, pipeline_id, event_type } = notification
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info
  const SeverityIcon = config.icon

  // State for copy feedback
  const [copied, setCopied] = useState(false)

  // Check if we should show the "Go to pipeline" button (not for deleted pipelines)
  const showGoToPipeline = pipeline_id && event_type !== 'pipeline_deleted'

  const handleCopyPipelineId = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!pipeline_id) return

    try {
      await navigator.clipboard.writeText(pipeline_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      structuredLogger.error('NotificationItem failed to copy pipeline ID', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div
      className={cn(
        'group relative flex gap-3 p-4',
        // 'border-l-1 rounded-[var(--radius-md)]',
        'border-0 rounded-[var(--radius-md)]',
        'transition-all duration-200',
        'bg-[var(--surface-bg)]',
        'hover:bg-[var(--option-bg-hover)] hover:shadow-md',
        !read && 'bg-[var(--option-bg-selected)]',
        isSelected && 'bg-[var(--option-bg-highlighted)] ring-1 ring-[var(--color-border-primary)]'
      )}
      style={{
        borderLeftColor: config.borderColorVar,
      }}
    >
      {/* Checkbox */}
      <div className="flex items-start pt-0.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className={cn(
            'h-4 w-4 rounded cursor-pointer',
            'border-[var(--control-border)] text-primary',
            'focus:ring-primary focus:ring-offset-0',
            'transition-all duration-200'
          )}
          aria-label={`Select notification: ${title}`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Unread indicator dot - inline with title */}
            {!read && (
              <div
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  'bg-[var(--color-background-primary)]',
                  'shadow-[0_0_4px_var(--color-background-primary)]'
                )}
                aria-label="Unread"
              />
            )}
            <h4
              className={cn(
                'text-sm font-medium truncate',
                !read && 'text-[var(--text-primary)]',
                read && 'text-[var(--text-secondary)]'
              )}
            >
              {title}
            </h4>
          </div>
          {/* Severity icon and timestamp - top right */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap mr-2">
              {formatTimestamp(timestamp)}
            </span>
            <SeverityIcon
              className="h-4 w-4"
              style={{ color: config.colorVar }}
            />
          </div>
        </div>

        <p
          className={cn(
            'text-sm line-clamp-2',
            read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)] opacity-80'
          )}
        >
          {message}
        </p>

        {/* Bottom row: pipeline info and action buttons */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {pipeline_id ? (
            <div className="flex items-center gap-1.5 group/pipeline">
              <p className="text-xs text-[var(--text-secondary)]">
                Pipeline: <span className="font-mono text-[var(--text-primary)]">{pipeline_id}</span>
              </p>
              <button
                onClick={handleCopyPipelineId}
                className={cn(
                  'p-0.5 rounded transition-all duration-200',
                  'opacity-0 group-hover/pipeline:opacity-100',
                  copied
                    ? 'text-[var(--color-foreground-positive)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-background-neutral-faded)]'
                )}
                title={copied ? 'Copied!' : 'Copy pipeline ID'}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
              {showGoToPipeline && (
                <Link
                  href={`/pipelines/${pipeline_id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClosePanel?.()
                  }}
                  className={cn(
                    'p-0.5 rounded transition-all duration-200',
                    'opacity-0 group-hover/pipeline:opacity-100',
                    'text-[var(--text-secondary)] hover:text-[var(--color-foreground-primary)] hover:bg-[var(--color-background-primary-faded)]'
                  )}
                  title="Go to pipeline"
                >
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          ) : (
            <div />
          )}

          {/* Action buttons - horizontal, bottom right */}
          <div
            className={cn(
              'flex items-center gap-1',
              'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
              'transition-opacity duration-200'
            )}
          >
            {!read && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 w-6 p-0',
                  'hover:bg-[var(--color-background-positive-faded)] hover:text-[var(--color-foreground-positive)]',
                  'transition-all duration-200'
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkAsRead()
                }}
                title="Mark as read"
              >
                <Check className="h-3.5 w-3.5" />
                <span className="sr-only">Mark as read</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 w-6 p-0',
                'text-[var(--color-foreground-critical)]',
                'hover:text-[var(--color-foreground-critical)] hover:bg-[var(--color-background-critical-faded)]',
                'transition-all duration-200'
              )}
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title="Delete notification"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
