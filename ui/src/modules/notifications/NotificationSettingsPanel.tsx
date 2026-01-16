'use client'

import { useState, useEffect } from 'react'
import { BellOff, Bell } from 'lucide-react'
import { Switch } from '@/src/components/ui/switch'
import { cn } from '@/src/utils/common.client'
import { ChannelSettings } from './components/ChannelSettings'
import { SeverityMappings } from './components/SeverityMappings'

const MUTE_STORAGE_KEY = 'glassflow_notifications_muted'

/**
 * NotificationSettingsPanel Component
 *
 * Main settings panel that combines:
 * - Mute toggle (persisted to localStorage)
 * - Channel settings
 * - Severity mappings
 */
export function NotificationSettingsPanel() {
  const [isMuted, setIsMuted] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load mute state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(MUTE_STORAGE_KEY)
    if (stored !== null) {
      setIsMuted(stored === 'true')
    }
    setIsHydrated(true)
  }, [])

  // Save mute state to localStorage when it changes
  const handleMuteToggle = (muted: boolean) => {
    setIsMuted(muted)
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted))
  }

  return (
    <div className="space-y-8">
      {/* Mute Toggle Section */}
      <div
        className={cn(
          'p-6 border rounded-lg',
          isMuted
            ? 'border-yellow-500/30 bg-yellow-500/5'
            : 'border-border bg-card',
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'p-3 rounded-lg',
                isMuted ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary/10 text-primary',
              )}
            >
              {isMuted ? (
                <BellOff className="h-6 w-6" />
              ) : (
                <Bell className="h-6 w-6" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {isMuted ? 'Notifications Muted' : 'Notifications Active'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isMuted
                  ? 'You will not receive any notification alerts. The notification system is still running in the background.'
                  : 'You will receive notification alerts based on your channel and severity settings below.'}
              </p>
              {isMuted && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  Note: Notifications are still being recorded and can be viewed in the notifications list.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {isMuted ? 'Muted' : 'Active'}
            </span>
            {isHydrated && (
              <Switch
                checked={!isMuted}
                onCheckedChange={(checked) => handleMuteToggle(!checked)}
                aria-label="Toggle notification mute"
              />
            )}
          </div>
        </div>
      </div>

      {/* Channel Settings */}
      <div className={cn(isMuted && 'opacity-60 pointer-events-none')}>
        <ChannelSettings />
      </div>

      {/* Severity Mappings */}
      <div className={cn(isMuted && 'opacity-60 pointer-events-none')}>
        <SeverityMappings />
      </div>

      {/* Muted overlay message */}
      {isMuted && (
        <div className="p-4 border border-yellow-500/30 bg-yellow-500/5 rounded-lg">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            <strong>Notifications are muted.</strong> The settings above are dimmed but your
            configuration will be preserved. Toggle the mute switch above to resume receiving
            notifications.
          </p>
        </div>
      )}
    </div>
  )
}
