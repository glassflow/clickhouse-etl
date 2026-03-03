'use client'

import { Bell } from 'lucide-react'
import { useStore } from '@/src/store'
import { useNotifications } from '@/src/hooks/useNotifications'
import { isNotificationsEnabled } from '@/src/config/feature-flags'
import { Button } from '@/src/components/ui/button'
import { cn } from '@/src/utils/common.client'

/**
 * NotificationBadge Component
 *
 * Displays a bell icon with an unread count badge.
 * Clicking opens the notifications panel.
 * Hidden when notifications feature is disabled.
 */
export const NotificationBadge: React.FC = () => {
  // Check if notifications feature is enabled
  const notificationsEnabled = isNotificationsEnabled()

  // Initialize polling for notifications
  useNotifications({ enabled: notificationsEnabled })

  // Get notification state from store
  const { notificationsStore } = useStore()
  const { unreadCount, isLoading, togglePanel, isPanelOpen } = notificationsStore

  // Don't render anything if notifications are disabled
  if (!notificationsEnabled) {
    return null
  }

  // Format the count for display (99+ if over 99)
  const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString()

  return (
    <Button
      variant="ghost"
      className={cn(
        'relative p-2 lg:px-3 lg:py-2 transition-colors',
        isPanelOpen && 'bg-accent',
      )}
      onClick={togglePanel}
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      aria-expanded={isPanelOpen}
      aria-haspopup="dialog"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />

      {/* Unread count badge */}
      {unreadCount > 0 && (
        <span
          className={cn(
            'absolute flex items-center justify-center',
            'min-w-[18px] h-[18px] px-1',
            'text-[10px] font-semibold text-white',
            'bg-red-500 rounded-full',
            'top-0.5 right-0.5 lg:top-1 lg:right-1',
            'animate-in fade-in zoom-in-50 duration-200',
          )}
          aria-hidden="true"
        >
          {displayCount}
        </span>
      )}

      {/* Loading indicator */}
      {isLoading && unreadCount === 0 && (
        <span
          className="absolute top-1 right-1 w-2 h-2 bg-[var(--color-foreground-disabled)] rounded-full animate-pulse"
          aria-hidden="true"
        />
      )}
    </Button>
  )
}
