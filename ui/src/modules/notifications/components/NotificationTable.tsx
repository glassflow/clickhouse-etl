'use client'

import { useMemo } from 'react'
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
} from 'lucide-react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table'
import { cn } from '@/src/utils/common.client'
import type { Notification, NotificationSeverity } from '@/src/services/notifications-api'

/**
 * Get the severity badge variant
 */
const getSeverityBadge = (severity: NotificationSeverity) => {
  switch (severity) {
    case 'critical':
      return { variant: 'destructive' as const, icon: XCircle, label: 'Critical' }
    case 'error':
      return { variant: 'destructive' as const, icon: AlertCircle, label: 'Error' }
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
      <div className="p-8 text-center border border-border rounded-lg">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive/50" />
        <p className="mt-2 text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchNotifications} className="mt-4">
          Try again
        </Button>
      </div>
    )
  }

  if (!isLoading && notifications.length === 0) {
    return (
      <div className="p-12 text-center border border-border rounded-lg">
        <Bell className="h-16 w-16 mx-auto text-muted-foreground/30" />
        <p className="mt-4 text-lg text-muted-foreground">No notifications found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or check back later
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {hasSelection && (
        <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg border border-border">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} notification{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkSelectedAsRead}
              className="h-8"
            >
              <Check className="h-4 w-4 mr-1" />
              Mark as Read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              className="h-8 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  aria-label="Select all"
                  disabled={notifications.length === 0}
                />
              </TableHead>
              <TableHead className="w-24">Severity</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Pipeline</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading notifications...</p>
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((notification) => (
                <NotificationTableRow
                  key={notification.notification_id}
                  notification={notification}
                  isSelected={selectedIds.has(notification.notification_id)}
                  onToggleSelect={() => toggleSelection(notification.notification_id)}
                  onMarkAsRead={() => markAsRead(notification.notification_id)}
                  onDelete={() => deleteNotification(notification.notification_id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="h-8 px-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>per page</span>
            <span className="ml-4">
              Showing {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageNumbers.map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePageChange(page)}
                className="h-8 w-8 p-0"
              >
                {page}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
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
  onToggleSelect,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification
  isSelected: boolean
  onToggleSelect: () => void
  onMarkAsRead: () => void
  onDelete: () => void
}) {
  const { notification_id, title, message, severity, timestamp, read, pipeline_id } = notification
  const severityInfo = getSeverityBadge(severity)
  const SeverityIcon = severityInfo.icon

  return (
    <TableRow
      className={cn(
        !read && 'bg-accent/10',
        isSelected && 'bg-accent/30',
      )}
    >
      <TableCell>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          aria-label={`Select notification: ${title}`}
        />
      </TableCell>
      <TableCell>
        <Badge variant={severityInfo.variant} className="gap-1">
          <SeverityIcon className="h-3 w-3" />
          {severityInfo.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <p className={cn('font-medium', !read && 'text-foreground', read && 'text-muted-foreground')}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1">{message}</p>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {pipeline_id ? (
          <span className="font-mono text-xs">{pipeline_id}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
        {formatDate(timestamp)}
      </TableCell>
      <TableCell>
        {read ? (
          <span className="text-xs text-muted-foreground">Read</span>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Unread
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {!read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAsRead}
              className="h-7 w-7 p-0"
              title="Mark as read"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
