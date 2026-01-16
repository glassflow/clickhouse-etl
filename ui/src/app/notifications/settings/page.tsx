'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, ChevronLeft } from 'lucide-react'
import { isNotificationsEnabled } from '@/src/config/feature-flags'
import { Button } from '@/src/components/ui/button'
import { NotificationSettingsPanel } from '@/src/modules/notifications/NotificationSettingsPanel'

/**
 * Notification Settings Page
 *
 * Configuration page for notification channels and severity mappings.
 */
export default function NotificationSettingsPage() {
  const router = useRouter()
  const notificationsEnabled = isNotificationsEnabled()

  // Redirect if notifications are disabled
  useEffect(() => {
    if (!notificationsEnabled) {
      router.push('/home')
    }
  }, [notificationsEnabled, router])

  if (!notificationsEnabled) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link href="/notifications">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Notifications
          </Button>
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground">
            Configure notification channels and severity routing
          </p>
        </div>
      </div>

      {/* Settings Content */}
      <NotificationSettingsPanel />
    </div>
  )
}
