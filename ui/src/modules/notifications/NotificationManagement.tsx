'use client'

import { RefreshCw } from 'lucide-react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
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
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total:</span>
            <Badge variant="secondary">{totalCount}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Unread:</span>
            <Badge variant={unreadCount > 0 ? 'destructive' : 'secondary'}>
              {unreadCount}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <NotificationFilters />

      {/* Table */}
      <NotificationTable />
    </div>
  )
}
