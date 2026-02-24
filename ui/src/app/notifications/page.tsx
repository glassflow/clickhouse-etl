'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Settings } from 'lucide-react'
import { isNotificationsEnabled } from '@/src/config/feature-flags'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { NotificationManagement } from '@/src/modules/notifications/NotificationManagement'

/**
 * Notifications Page
 *
 * Full page for managing notifications with advanced filtering,
 * search, and bulk operations.
 */
export default function NotificationsPage() {
  const router = useRouter()
  const notificationsEnabled = isNotificationsEnabled()
  const { notificationsStore } = useStore()
  const { fetchNotifications, closePanel } = notificationsStore

  // Redirect if notifications are disabled
  useEffect(() => {
    if (!notificationsEnabled) {
      router.push('/home')
    }
  }, [notificationsEnabled, router])

  // Close the slide-out panel when viewing the full page
  useEffect(() => {
    closePanel()
  }, [closePanel])

  // Fetch notifications on mount
  useEffect(() => {
    if (notificationsEnabled) {
      fetchNotifications()
    }
  }, [notificationsEnabled, fetchNotifications])

  if (!notificationsEnabled) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              Manage and review all pipeline notifications
            </p>
          </div>
        </div>
        <Link href="/notifications/settings">
          <Button variant="primary" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>

      {/* Main Content */}
      <NotificationManagement />
    </div>
  )
}
