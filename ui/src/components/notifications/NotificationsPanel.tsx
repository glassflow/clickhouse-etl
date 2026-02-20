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
        className={cn(
          'w-full sm:max-w-lg flex flex-col p-0',
          'bg-[var(--surface-bg-overlay)]',
          'border-l border-[var(--surface-border)]'
        )}
        aria-describedby={undefined}
      >
        {/* Header */}
        <SheetHeader
          className={cn(
            'px-5 py-4 space-y-0',
            'border-b border-[var(--surface-border)]',
            'bg-[var(--surface-bg)]'
          )}
        >
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-background-primary-faded)]">
                <Bell className="h-5 w-5 text-[var(--color-foreground-primary)]" />
              </div>
              <SheetTitle className="text-lg font-semibold text-[var(--text-primary)]">
                Notifications
              </SheetTitle>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 font-medium">
                  {unreadCount} new
                </Badge>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className={cn(
                  'h-8 w-8 p-0',
                  'hover:bg-[var(--color-background-neutral-faded)]',
                  'transition-all duration-200'
                )}
                title="Refresh notifications"
              >
                <RefreshCw className={cn('h-4 w-4 text-[var(--text-secondary)]', isLoading && 'animate-spin')} />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>

          </div>
        </SheetHeader>

        {/* Filter tabs */}
        <div
          className={cn(
            'px-5 py-3',
            'border-b border-[var(--surface-border)]',
            'bg-[var(--surface-bg-sunken)]',
            'flex items-center gap-3'
          )}
        >
          <div className="p-1.5 rounded-md bg-[var(--color-background-neutral-faded)]">
            <Filter className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
          </div>
          <div className="flex gap-1">
            {(['all', 'unread', 'read'] as FilterOption[]).map((option) => (
              <Button
                key={option}
                variant={filter === option ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(option)}
                className={cn(
                  'h-7 px-3 text-xs capitalize',
                  'transition-all duration-200',
                  filter === option
                    ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-background-neutral-faded)]'
                )}
              >
                {option}
                {option === 'unread' && unreadCount > 0 && (
                  <span className="ml-1.5 text-[var(--text-secondary)]">({unreadCount})</span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Bulk actions bar - visible when items are selected */}
        {hasSelection && (
          <div
            className={cn(
              'px-5 py-3',
              'border-b border-[var(--color-border-primary-faded)]',
              'bg-[var(--color-background-primary-faded)]',
              'flex items-center justify-between',
              'animate-slideDown'
            )}
          >
            <div className="flex items-center gap-2">
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
              />
              <span className="text-sm text-[var(--text-primary)] font-medium">
                {selectedIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkSelectedAsRead}
                className={cn(
                  'h-7 px-2 text-xs',
                  'text-[var(--text-primary)]',
                  'hover:bg-[var(--color-background-positive-faded)] hover:text-[var(--color-foreground-positive)]',
                  'transition-all duration-200'
                )}
                title="Mark selected as read"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteSelected}
                className={cn(
                  'h-7 px-2 text-xs',
                  'text-[var(--color-foreground-critical)]',
                  'hover:text-[var(--color-foreground-critical)] hover:bg-[var(--color-background-critical-faded)]',
                  'transition-all duration-200'
                )}
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
          <div
            className={cn(
              'px-5 py-2.5',
              'border-b border-[var(--surface-border)]',
              'flex items-center gap-2',
              'bg-[var(--surface-bg-sunken)]'
            )}
          >
            <input
              type="checkbox"
              checked={false}
              onChange={handleSelectAll}
              className={cn(
                'h-4 w-4 rounded cursor-pointer',
                'border-[var(--control-border)] text-primary',
                'focus:ring-primary focus:ring-offset-0'
              )}
              aria-label="Select all"
            />
            <span className="text-xs text-[var(--text-secondary)]">Select all</span>
          </div>
        )}

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto bg-[var(--surface-bg-sunken)]">
          {error && (
            <div className="p-6 text-center animate-fadeIn">
              <div className="p-3 rounded-full bg-[var(--color-background-critical-faded)] w-fit mx-auto">
                <Bell className="h-6 w-6 text-[var(--color-foreground-critical)]" />
              </div>
              <p className="mt-3 text-sm text-[var(--text-error)]">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-3 btn-neutral transition-all duration-200"
              >
                Try again
              </Button>
            </div>
          )}

          {!error && isLoading && notifications.length === 0 && (
            <div className="p-8 text-center animate-fadeIn">
              <RefreshCw className="h-8 w-8 mx-auto text-[var(--text-secondary)] animate-spin" />
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading notifications...</p>
            </div>
          )}

          {!error && !isLoading && filteredNotifications.length === 0 && (
            <div className="p-10 text-center animate-fadeIn">
              <div className="p-4 rounded-full bg-[var(--color-background-neutral-faded)] w-fit mx-auto">
                <Bell className="h-10 w-10 text-[var(--text-secondary)] opacity-50" />
              </div>
              <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">
                {filter === 'all'
                  ? 'No notifications yet'
                  : filter === 'unread'
                    ? 'No unread notifications'
                    : 'No read notifications'}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {filter === 'all'
                  ? "You're all caught up!"
                  : 'Try changing your filter'}
              </p>
            </div>
          )}

          {!error && filteredNotifications.length > 0 && (
            <div className="flex flex-col gap-3 p-4">
              {filteredNotifications.map((notification, index) => (
                <div
                  key={notification.notification_id}
                  className="animate-fadeIn"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <NotificationItem
                    notification={notification}
                    isSelected={selectedIds.has(notification.notification_id)}
                    onSelect={() => toggleSelection(notification.notification_id)}
                    onMarkAsRead={() => markAsRead(notification.notification_id)}
                    onDelete={() => deleteNotification(notification.notification_id)}
                    onClosePanel={closePanel}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={cn(
            'px-5 py-4',
            'border-t border-[var(--surface-border)]',
            'bg-[var(--surface-bg)]',
            'flex items-center justify-between'
          )}
        >
          {totalCount > 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Showing {filteredNotifications.length} of {totalCount}
            </p>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-4">
            <Link
              href="/notifications/settings"
              onClick={closePanel}
              className={cn(
                'text-xs flex items-center gap-1.5',
                'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                'transition-colors duration-200'
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>
            <Link
              href="/notifications"
              onClick={closePanel}
              className={cn(
                'text-xs flex items-center gap-1.5',
                'text-[var(--color-foreground-primary)] hover:text-[var(--text-link-hover)]',
                'transition-colors duration-200'
              )}
            >
              View all
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
