'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { structuredLogger } from '@/src/observability'
import {
  Check,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Bell,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { cn } from '@/src/utils/common.client'
import type { Notification, NotificationSeverity } from '@/src/services/notifications-api'

/**
 * Get the severity badge variant
 * Matches the badge styling used in pipelines table for consistency
 */
const getSeverityBadge = (severity: NotificationSeverity) => {
  switch (severity) {
    case 'critical':
      return { variant: 'error' as const, icon: XCircle, label: 'Critical' }
    case 'error':
      return { variant: 'error' as const, icon: AlertCircle, label: 'Error' }
    case 'warning':
      return { variant: 'warning' as const, icon: AlertTriangle, label: 'Warning' }
    case 'info':
    default:
      return { variant: 'default' as const, icon: Info, label: 'Info' }
  }
}

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleString()
  } catch {
    return 'Unknown'
  }
}

/**
 * NotificationTable Component
 *
 * Displays notifications in a table format with:
 * - Sortable columns
 * - Bulk selection
 * - Individual actions
 * - Pagination
 */
export function NotificationTable() {
  const { notificationsStore } = useStore()
  const {
    notifications,
    totalCount,
    isLoading,
    error,
    currentPage,
    pageSize,
    selectedIds,
    setPage,
    setPageSize,
    selectNotification,
    deselectNotification,
    toggleSelection,
    selectAll,
    deselectAll,
    markAsRead,
    deleteNotification,
    markSelectedAsRead,
    deleteSelected,
    fetchNotifications,
  } = notificationsStore

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / pageSize)
  const hasSelection = selectedIds.size > 0
  const allSelected = notifications.length > 0 && notifications.every((n) => selectedIds.has(n.notification_id))

  // Track expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Clear expanded rows when notifications change (page change, filter change, etc.)
  useEffect(() => {
    setExpandedRows(new Set())
  }, [notifications])

  const toggleRowExpansion = (notificationId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(notificationId)) {
        next.delete(notificationId)
      } else {
        next.add(notificationId)
      }
      return next
    })
  }

  // Grid template is handled by CSS class for responsive behavior

  // Page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      const startPage = Math.max(1, currentPage - 2)
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }
    }

    return pages
  }, [currentPage, totalPages])

  const handleSelectAll = () => {
    if (allSelected) {
      deselectAll()
    } else {
      selectAll()
    }
  }

  const handlePageChange = (page: number) => {
    setPage(page)
    fetchNotifications()
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    fetchNotifications()
  }

  const handleMarkSelectedAsRead = async () => {
    await markSelectedAsRead()
  }

  const handleDeleteSelected = async () => {
    await deleteSelected()
  }

  if (error) {
    return (
      <div
        className={cn(
          'card-outline p-8 text-center',
          'transition-all duration-200'
        )}
      >
        <div className="p-4 rounded-full bg-[var(--color-background-critical-faded)] w-fit mx-auto">
          <AlertCircle className="h-10 w-10 text-[var(--color-foreground-critical)]" />
        </div>
        <p className="mt-4 text-sm text-[var(--text-error)]">{error}</p>
        <Button
          size="sm"
          onClick={fetchNotifications}
          variant="secondary" className="mt-4 transition-all duration-200"
        >
          Try again
        </Button>
      </div>
    )
  }

  if (!isLoading && notifications.length === 0) {
    return (
      <div
        className={cn(
          'card-outline p-12 text-center',
          'transition-all duration-200'
        )}
      >
        <div className="p-5 rounded-full bg-[var(--color-background-neutral-faded)] w-fit mx-auto">
          <Bell className="h-12 w-12 text-[var(--text-secondary)] opacity-50" />
        </div>
        <p className="mt-6 text-lg font-medium text-[var(--text-primary)]">No notifications found</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Try adjusting your filters or check back later
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk Actions Bar */}
      {hasSelection && (
        <div
          className={cn(
            'flex items-center justify-between p-4',
            'rounded-[var(--radius-xl)]',
            'bg-[var(--color-background-primary-faded)] border border-[var(--color-border-primary-faded)]',
            'animate-slideDown',
            'transition-all duration-200'
          )}
        >
          <span className="text-sm text-[var(--text-primary)] font-medium">
            {selectedIds.size} notification{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkSelectedAsRead}
              className={cn(
                'h-8',
                'transition-all duration-200'
              )}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Mark as Read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              className={cn(
                'h-8',
                'text-[var(--color-foreground-critical)] hover:text-[var(--color-foreground-critical)]',
                'border-[var(--color-border-critical-faded)] hover:border-[var(--color-border-critical)]',
                'hover:bg-[var(--color-background-critical-faded)]',
                'transition-all duration-200'
              )}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        {/* Table Header */}
        <div className="table-header">
          <div className="table-header-row notifications-table-row">
            <div className="table-header-cell">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className={cn(
                  'h-4 w-4 rounded cursor-pointer',
                  'border-[var(--control-border)] text-primary',
                  'focus:ring-primary focus:ring-offset-0'
                )}
                aria-label="Select all"
                disabled={notifications.length === 0}
              />
            </div>
            <div className="table-header-cell">Severity</div>
            <div className="table-header-cell">Title</div>
            <div className="table-header-cell">Pipeline</div>
            <div className="table-header-cell">Date</div>
            <div className="table-header-cell">Status</div>
            <div className="table-header-cell text-right">Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="table-body">
          {isLoading && notifications.length === 0 ? (
            <div className="table-cell-empty">
              <RefreshCw className="h-6 w-6 mx-auto animate-spin text-[var(--text-secondary)]" />
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="table-cell-empty">
              <Bell className="h-8 w-8 mx-auto text-[var(--text-secondary)] opacity-50" />
              <p className="mt-4 text-sm text-[var(--text-secondary)]">No notifications found</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationTableRow
                key={notification.notification_id}
                notification={notification}
                isSelected={selectedIds.has(notification.notification_id)}
                isExpanded={expandedRows.has(notification.notification_id)}
                onToggleSelect={() => toggleSelection(notification.notification_id)}
                onToggleExpand={() => toggleRowExpansion(notification.notification_id)}
                onMarkAsRead={() => markAsRead(notification.notification_id)}
                onDelete={() => deleteNotification(notification.notification_id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div
          className={cn(
            'flex items-center justify-between',
            'p-4 rounded-[var(--radius-xl)]',
            'bg-[var(--surface-bg)] border border-[var(--surface-border)]',
            'transition-all duration-200'
          )}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span>Show</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
            >
              <SelectTrigger
                size="sm"
                className={cn(
                  'h-8 px-2 rounded-[var(--radius-md)]',
                  'bg-[var(--control-bg)] border border-[var(--control-border)]',
                  'text-[var(--text-primary)]',
                  'hover:border-[var(--control-border-hover)]',
                  'focus:border-[var(--control-border-focus)] focus:outline-none focus:shadow-[var(--control-shadow-focus)]',
                  'transition-all duration-200'
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="select-content-custom">
                <SelectItem value="10" className="select-item-custom">10</SelectItem>
                <SelectItem value="20" className="select-item-custom">20</SelectItem>
                <SelectItem value="50" className="select-item-custom">50</SelectItem>
                <SelectItem value="100" className="select-item-custom">100</SelectItem>
              </SelectContent>
            </Select>
            <span>per page</span>
            <span className="ml-4 text-[var(--text-primary)]">
              Showing {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              variant="secondary" className="h-8 w-8 p-0 transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageNumbers.map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'secondary'}
                size="sm"
                onClick={() => handlePageChange(page)}
                className="h-8 w-8 p-0 transition-all duration-200"
              >
                {page}
              </Button>
            ))}

            <Button
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              variant="secondary"
              className="h-8 w-8 p-0 transition-all duration-200"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Individual table row for a notification
 */
function NotificationTableRow({
  notification,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification
  isSelected: boolean
  isExpanded: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onMarkAsRead: () => void
  onDelete: () => void
}) {
  const { notification_id, title, message, severity, timestamp, read, pipeline_id, event_type } = notification
  const severityInfo = getSeverityBadge(severity)
  const SeverityIcon = severityInfo.icon

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
      structuredLogger.error('NotificationTable failed to copy pipeline ID', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <>
      <div
        className={cn(
          'table-row notifications-table-row',
          !read && 'bg-[var(--color-background-primary)]/10',
          isSelected && 'bg-[var(--option-bg-highlighted)]'
        )}
      >
        <div className="table-cell">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'h-4 w-4 rounded cursor-pointer',
              'border-[var(--control-border)] text-primary',
              'focus:ring-primary focus:ring-offset-0'
            )}
            aria-label={`Select notification: ${title}`}
          />
        </div>
        <div className="table-cell">
          <Badge variant={severityInfo.variant} className="rounded-xl gap-1">
            <SeverityIcon className="h-3 w-3" />
            {severityInfo.label}
          </Badge>
        </div>
        <div
          className="table-cell min-w-0 cursor-pointer"
          onClick={onToggleExpand}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleExpand()
            }
          }}
          aria-expanded={isExpanded}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-medium',
                  !read && 'text-[var(--text-primary)]',
                  read && 'text-[var(--text-secondary)]',
                  !isExpanded && 'line-clamp-2',
                  'break-words'
                )}>
                  {title}
                </p>
                <p className={cn(
                  'text-xs text-[var(--text-secondary)]',
                  !isExpanded && 'line-clamp-1',
                  'break-words mt-1'
                )}>
                  {message}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand()
                }}
                className={cn(
                  'flex-shrink-0 p-1 rounded hover:bg-[var(--color-background-neutral-faded)]',
                  'transition-all duration-200',
                  'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="table-cell">
          {pipeline_id ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-[var(--text-primary)]">{pipeline_id}</span>
              <button
                onClick={handleCopyPipelineId}
                className={cn(
                  'p-0.5 rounded transition-all duration-200',
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
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'p-0.5 rounded transition-all duration-200',
                    'text-[var(--text-secondary)] hover:text-[var(--color-foreground-primary)] hover:bg-[var(--color-background-primary-faded)]'
                  )}
                  title="Go to pipeline"
                >
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          ) : (
            <span className="text-[var(--text-secondary)]">—</span>
          )}
        </div>
        <div className="table-cell text-sm text-[var(--text-secondary)]">
          {formatDate(timestamp)}
        </div>
        <div className="table-cell">
          {read ? (
            <span className="text-xs text-[var(--text-secondary)]">Read</span>
          ) : (
            <Badge variant="secondary" className="rounded-xl text-xs">
              Unread
            </Badge>
          )}
        </div>
        <div className="table-cell text-right">
          <div className="flex items-center justify-end gap-4">
            {!read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkAsRead()
                }}
                className={cn(
                  'h-7 w-7 p-0',
                  'hover:bg-[var(--color-background-positive-faded)] hover:text-[var(--color-foreground-positive)]',
                  'transition-all duration-200'
                )}
                title="Mark as read"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className={cn(
                'h-7 w-7 p-0',
                'text-[var(--color-foreground-critical)] hover:text-[var(--color-foreground-critical)]',
                'hover:bg-[var(--color-background-critical-faded)]',
                'transition-all duration-200'
              )}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {/* Expanded details row */}
      {isExpanded && (
        <div
          className="table-row bg-[var(--color-background-primary-faded)]"
          style={{ gridColumn: '1 / -1', display: 'block' }}
        >
          <div className="p-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Title</p>
                <p className={cn(
                  'text-sm break-words',
                  !read && 'text-[var(--text-primary)]',
                  read && 'text-[var(--text-secondary)]'
                )}>
                  {title}
                </p>
              </div>
              {message && (
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Message</p>
                  <p className="text-sm text-[var(--text-secondary)] break-words whitespace-pre-wrap">
                    {message}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap justify-end items-center gap-4 text-xs text-[var(--text-secondary)] mt-6">
                {pipeline_id && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Pipeline:</span>
                    <span className="font-mono">{pipeline_id}</span>
                    <button
                      onClick={handleCopyPipelineId}
                      className={cn(
                        'p-0.5 rounded transition-all duration-200',
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
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'p-0.5 rounded transition-all duration-200',
                          'text-[var(--text-secondary)] hover:text-[var(--color-foreground-primary)] hover:bg-[var(--color-background-primary-faded)]'
                        )}
                        title="Go to pipeline"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
                <div>
                  <span className="font-medium">Date:</span>{' '}
                  <span>{formatDate(timestamp)}</span>
                </div>
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <span>{read ? 'Read' : 'Unread'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
