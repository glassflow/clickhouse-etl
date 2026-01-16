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
 * Get the icon component for a notification severity
 */
const getSeverityIcon = (severity: NotificationSeverity) => {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-400" />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case 'info':
    default:
      return <Info className="h-4 w-4 text-blue-400" />
  }
}

/**
 * Get the border color class for a notification severity
 */
const getSeverityBorderClass = (severity: NotificationSeverity) => {
  switch (severity) {
    case 'critical':
      return 'border-l-red-500'
    case 'error':
      return 'border-l-red-400'
    case 'warning':
      return 'border-l-yellow-500'
    case 'info':
    default:
      return 'border-l-blue-400'
  }
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

  return (
    <div
      className={cn(
        'group relative flex gap-3 p-3 border-l-4 rounded-r-md transition-colors',
        'hover:bg-accent/50',
        getSeverityBorderClass(severity),
        !read && 'bg-accent/20',
        isSelected && 'bg-accent/40 ring-1 ring-primary',
      )}
    >
      {/* Checkbox for selection */}
      <div className="flex items-start pt-0.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          aria-label={`Select notification: ${title}`}
        />
      </div>

      {/* Severity icon */}
      <div className="flex-shrink-0 pt-0.5">{getSeverityIcon(severity)}</div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={cn(
              'text-sm font-medium truncate',
              !read && 'text-foreground',
              read && 'text-muted-foreground',
            )}
          >
            {title}
          </h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatTimestamp(timestamp)}
          </span>
        </div>

        <p className={cn('text-sm line-clamp-2', read ? 'text-muted-foreground' : 'text-foreground/80')}>
          {message}
        </p>

        {pipeline_id && (
          <p className="text-xs text-muted-foreground">
            Pipeline: <span className="font-mono">{pipeline_id}</span>
          </p>
        )}
      </div>

      {/* Action buttons - visible on hover or when focused */}
      <div
        className={cn(
          'flex flex-col gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          'transition-opacity duration-150',
        )}
      >
        {!read && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
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
          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
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
          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}
    </div>
  )
}
