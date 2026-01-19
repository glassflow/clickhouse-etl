'use client'

import { RefreshCw } from 'lucide-react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { cn } from '@/src/utils/common.client'
import { NotificationFilters } from './components/NotificationFilters'
import { NotificationTable } from './components/NotificationTable'

/**
 * NotificationManagement Component
 *
 * Main container for the notification management page.
 * Combines filters, summary stats, and the notification table.
 */
export function NotificationManagement() {
  const { notificationsStore } = useStore()
  const { totalCount, unreadCount, isLoading, fetchNotifications } = notificationsStore

  const handleRefresh = () => {
    fetchNotifications()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Bar */}
      <div
        className={cn(
          'flex items-center justify-between',
          'p-4 rounded-[var(--radius-large)]',
          'bg-[var(--surface-bg)] border border-[var(--surface-border)]',
          'shadow-[var(--card-shadow)]',
          'animate-fadeIn'
        )}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-secondary)]">Total:</span>
            <Badge variant="secondary" className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-secondary-faded)]">{totalCount}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-secondary)]">Unread:</span>
            <Badge
              variant={unreadCount > 0 ? 'destructive' : 'secondary'}
              className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-secondary-faded)]"
            >
              {unreadCount}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="btn-neutral"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="animate-fadeIn animate-delay-100">
        <NotificationFilters />
      </div>

      {/* Table */}
      <div className="animate-fadeIn animate-delay-200">
        <NotificationTable />
      </div>
    </div>
  )
}
