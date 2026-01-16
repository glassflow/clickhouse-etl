'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, MessageSquare, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Switch } from '@/src/components/ui/switch'
import { Badge } from '@/src/components/ui/badge'
import { cn } from '@/src/utils/common.client'
import { notificationsApi, type Channel, type ChannelType } from '@/src/services/notifications-api'

interface ChannelCardProps {
  channel: Channel | null
  channelType: ChannelType
  isLoading: boolean
  onToggle: (enabled: boolean) => Promise<void>
}

/**
 * Individual channel card component
 */
function ChannelCard({ channel, channelType, isLoading, onToggle }: ChannelCardProps) {
  const [toggling, setToggling] = useState(false)

  const isSlack = channelType === 'slack'
  const Icon = isSlack ? MessageSquare : Mail
  const title = isSlack ? 'Slack' : 'Email'
  const description = isSlack
    ? 'Receive notifications via Slack webhook'
    : 'Receive notifications via email'

  const isEnabled = channel?.enabled ?? false
  const isConfigured = channel !== null

  const handleToggle = async (checked: boolean) => {
    setToggling(true)
    try {
      await onToggle(checked)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div
      className={cn(
        'p-4 border border-border rounded-lg',
        isEnabled && 'border-primary/30 bg-primary/5',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'p-2 rounded-lg',
              isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{title}</h3>
              {isConfigured ? (
                <Badge variant={isEnabled ? 'default' : 'secondary'} className="text-xs">
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Not Configured
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>

            {/* Configuration status */}
            {isConfigured && channel && (
              <div className="mt-2 text-xs text-muted-foreground">
                {isSlack ? (
                  <span>Webhook configured</span>
                ) : (
                  <span>SMTP: {(channel.config as any)?.smtp_host || 'configured'}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConfigured && (
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={isLoading || toggling}
              aria-label={`Toggle ${title} notifications`}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * ChannelSettings Component
 *
 * Displays and manages notification channel configurations.
 * Shows Slack and Email channels with their enable/disable status.
 */
export function ChannelSettings() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChannels = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const result = await notificationsApi.fetchChannels()

    if (result.success && result.data) {
      setChannels(result.data.channels)
    } else {
      setError(result.error || 'Failed to load channels')
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const handleToggleChannel = useCallback(
    async (channelType: ChannelType, enabled: boolean) => {
      const result = await notificationsApi.updateChannel(channelType, { enabled })

      if (result.success && result.data) {
        setChannels((prev) =>
          prev.map((ch) =>
            ch.channel_type === channelType ? result.data! : ch,
          ),
        )
      } else {
        // Refetch to get correct state
        fetchChannels()
      }
    },
    [fetchChannels],
  )

  const slackChannel = channels.find((ch) => ch.channel_type === 'slack') || null
  const emailChannel = channels.find((ch) => ch.channel_type === 'email') || null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notification Channels</h2>
          <p className="text-sm text-muted-foreground">
            Configure how you receive notifications
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchChannels}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 border border-destructive/30 bg-destructive/10 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchChannels} className="mt-2">
            Try again
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ChannelCard
          channel={slackChannel}
          channelType="slack"
          isLoading={isLoading}
          onToggle={(enabled) => handleToggleChannel('slack', enabled)}
        />
        <ChannelCard
          channel={emailChannel}
          channelType="email"
          isLoading={isLoading}
          onToggle={(enabled) => handleToggleChannel('email', enabled)}
        />
      </div>

      {!isLoading && channels.length === 0 && !error && (
        <div className="p-6 text-center border border-border rounded-lg">
          <p className="text-muted-foreground">
            No channels configured. Contact your administrator to set up notification channels.
          </p>
        </div>
      )}
    </div>
  )
}
