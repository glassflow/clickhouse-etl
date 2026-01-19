'use client'

import { Check, Trash2, AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import { Button } from '@/src/components/ui/button'
import type { Notification, NotificationSeverity } from '@/src/services/notifications-api'

interface NotificationItemProps {
  notification: Notification
  isSelected: boolean
  onSelect: () => void
  onMarkAsRead: () => void
  onDelete: () => void
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
}: NotificationItemProps) {
  const { notification_id, title, message, severity, timestamp, read, pipeline_id } = notification
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info
  const SeverityIcon = config.icon

  return (
    <div
      className={cn(
        'group relative flex gap-3 p-4',
        'border-l-4 rounded-r-[var(--radius-medium)]',
        'transition-all duration-200',
        'hover:bg-[var(--option-bg-hover)]',
        !read && 'bg-[var(--option-bg-selected)]',
        isSelected && 'bg-[var(--option-bg-highlighted)] ring-1 ring-[var(--color-border-primary)]'
      )}
      style={{
        borderLeftColor: config.borderColorVar,
      }}
    >
      {/* Checkbox for selection */}
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

      {/* Severity icon */}
      <div
        className="flex-shrink-0 pt-0.5 p-1.5 rounded-[var(--radius-small)]"
        style={{ backgroundColor: config.bgColorVar }}
      >
        <SeverityIcon
          className="h-4 w-4"
          style={{ color: config.colorVar }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={cn(
              'text-sm font-medium truncate',
              !read && 'text-[var(--text-primary)]',
              read && 'text-[var(--text-secondary)]'
            )}
          >
            {title}
          </h4>
          <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap flex-shrink-0">
            {formatTimestamp(timestamp)}
          </span>
        </div>

        <p
          className={cn(
            'text-sm line-clamp-2',
            read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)] opacity-80'
          )}
        >
          {message}
        </p>

        {pipeline_id && (
          <p className="text-xs text-[var(--text-secondary)]">
            Pipeline: <span className="font-mono text-[var(--text-primary)]">{pipeline_id}</span>
          </p>
        )}
      </div>

      {/* Action buttons - visible on hover or when focused */}
      <div
        className={cn(
          'flex flex-col gap-1',
          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          'transition-opacity duration-200'
        )}
      >
        {!read && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 w-7 p-0',
              'hover:bg-[var(--color-background-positive-faded)] hover:text-[var(--color-foreground-positive)]',
              'transition-all duration-200'
            )}
            onClick={(e) => {
              e.stopPropagation()
              onMarkAsRead()
            }}
            title="Mark as read"
          >
            <Check className="h-4 w-4" />
            <span className="sr-only">Mark as read</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 w-7 p-0',
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
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>

      {/* Unread indicator dot */}
      {!read && (
        <div
          className={cn(
            'absolute top-4 right-4',
            'w-2 h-2 rounded-full',
            'bg-[var(--color-background-primary)]',
            'shadow-[0_0_4px_var(--color-background-primary)]'
          )}
          aria-label="Unread"
        />
      )}
    </div>
  )
}
