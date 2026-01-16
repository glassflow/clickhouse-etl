'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Bell, Check, Trash2, RefreshCw, Filter, ExternalLink, Settings } from 'lucide-react'
import { useStore } from '@/src/store'
import { isNotificationsEnabled } from '@/src/config/feature-flags'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/src/components/ui/sheet'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { cn } from '@/src/utils/common.client'
import { NotificationItem } from './NotificationItem'

type FilterOption = 'all' | 'unread' | 'read'

/**
 * NotificationsPanel Component
 *
 * A slide-out panel that displays notifications with filtering and bulk actions.
 * Opens from the right side of the screen when triggered by the NotificationBadge.
 */
export function NotificationsPanel() {
  const notificationsEnabled = isNotificationsEnabled()
  const { notificationsStore } = useStore()
  const {
    notifications,
    unreadCount,
    totalCount,
    isLoading,
    error,
    isPanelOpen,
    closePanel,
    selectedIds,
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

  // Local filter state
  const [filter, setFilter] = useState<FilterOption>('all')

  // Filter notifications based on selected filter
  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case 'unread':
        return notifications.filter((n) => !n.read)
      case 'read':
        return notifications.filter((n) => n.read)
      default:
        return notifications
    }
  }, [notifications, filter])

  // Check if any notifications are selected
  const hasSelection = selectedIds.size > 0
  const allSelected = filteredNotifications.length > 0 && filteredNotifications.every((n) => selectedIds.has(n.notification_id))

  // Don't render if notifications are disabled
  if (!notificationsEnabled) {
    return null
  }

  const handleSelectAll = () => {
    if (allSelected) {
      deselectAll()
    } else {
      // Only select filtered notifications
      filteredNotifications.forEach((n) => selectNotification(n.notification_id))
    }
  }

  const handleMarkSelectedAsRead = async () => {
    await markSelectedAsRead()
  }

  const handleDeleteSelected = async () => {
    await deleteSelected()
  }

  const handleRefresh = () => {
    fetchNotifications()
  }

  return (
    <Sheet open={isPanelOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 bg-[var(--color-background-elevation-raised)]"
        aria-describedby={undefined}
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border space-y-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <SheetTitle className="text-lg font-semibold">Notifications</SheetTitle>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0"
              title="Refresh notifications"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Filter tabs */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {(['all', 'unread', 'read'] as FilterOption[]).map((option) => (
              <Button
                key={option}
                variant={filter === option ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(option)}
                className="h-7 px-2 text-xs capitalize"
              >
                {option}
                {option === 'unread' && unreadCount > 0 && (
                  <span className="ml-1 text-muted-foreground">({unreadCount})</span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Bulk actions bar - visible when items are selected */}
        {hasSelection && (
          <div className="px-4 py-2 border-b border-border bg-accent/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                aria-label="Select all"
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkSelectedAsRead}
                className="h-7 px-2 text-xs"
                title="Mark selected as read"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteSelected}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Delete selected"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Select all row - visible when no selection but has notifications */}
        {!hasSelection && filteredNotifications.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <input
              type="checkbox"
              checked={false}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              aria-label="Select all"
            />
            <span className="text-xs text-muted-foreground">Select all</span>
          </div>
        )}

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
                Try again
              </Button>
            </div>
          )}

          {!error && isLoading && notifications.length === 0 && (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
              <p className="mt-2 text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          )}

          {!error && !isLoading && filteredNotifications.length === 0 && (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {filter === 'all'
                  ? 'No notifications yet'
                  : filter === 'unread'
                    ? 'No unread notifications'
                    : 'No read notifications'}
              </p>
            </div>
          )}

          {!error && filteredNotifications.length > 0 && (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.notification_id}
                  notification={notification}
                  isSelected={selectedIds.has(notification.notification_id)}
                  onSelect={() => toggleSelection(notification.notification_id)}
                  onMarkAsRead={() => markAsRead(notification.notification_id)}
                  onDelete={() => deleteNotification(notification.notification_id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          {totalCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              Showing {filteredNotifications.length} of {totalCount}
            </p>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <Link
              href="/notifications/settings"
              onClick={closePanel}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Settings className="h-3 w-3" />
              Settings
            </Link>
            <Link
              href="/notifications"
              onClick={closePanel}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
