'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, MessageSquare, RefreshCw, Settings, Plus } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Switch } from '@/src/components/ui/switch'
import { Badge } from '@/src/components/ui/badge'
import { cn } from '@/src/utils/common.client'
import { notificationsApi, type Channel, type ChannelType } from '@/src/services/notifications-api'
import { ChannelConfigDialog } from './ChannelConfigDialog'

interface ChannelCardProps {
  channel: Channel | null
  channelType: ChannelType
  isLoading: boolean
  onToggle: (enabled: boolean) => Promise<void>
  onConfigure: () => void
}

/**
 * Individual channel card component
 */
function ChannelCard({ channel, channelType, isLoading, onToggle, onConfigure }: ChannelCardProps) {
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

  // Get configuration summary
  const getConfigSummary = () => {
    if (!channel) return null

    if (isSlack) {
      const config = channel.config as { webhook_url?: string; default_channel?: string }
      return config.default_channel || 'Webhook configured'
    } else {
      const config = channel.config as { smtp_host?: string; to_addresses?: string }
      const recipients = config.to_addresses?.split(',').length || 0
      return `${config.smtp_host || 'SMTP configured'} • ${recipients} recipient${recipients !== 1 ? 's' : ''}`
    }
  }

  return (
    <div
      className={cn(
        'content-card relative p-5',
        'transition-all duration-200',
        'hover:shadow-[var(--card-shadow-hover)]',
        isEnabled && 'border-[var(--color-border-primary-faded)] bg-[var(--color-background-primary-faded)]/10'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'p-2.5 rounded-[var(--radius-md)]',
              'transition-all duration-200',
              isEnabled
                ? 'bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]'
                : 'bg-[var(--color-background-neutral-faded)] text-[var(--text-secondary)]'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-[var(--text-primary)]">{title}</h3>
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
            <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>

            {/* Configuration summary */}
            {isConfigured && (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">{getConfigSummary()}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Configure/Edit button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onConfigure}
            disabled={isLoading}
            className="gap-1.5 btn-neutral transition-all duration-200"
          >
            {isConfigured ? (
              <>
                <Settings className="h-3.5 w-3.5" />
                Edit
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Configure
              </>
            )}
          </Button>

          {/* Enable/Disable toggle - only show if configured */}
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannelType, setEditingChannelType] = useState<ChannelType>('slack')

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

  const handleConfigureChannel = (channelType: ChannelType) => {
    setEditingChannelType(channelType)
    setDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    // Refetch channels to get updated configuration
    fetchChannels()
  }

  const slackChannel = channels.find((ch) => ch.channel_type === 'slack') || null
  const emailChannel = channels.find((ch) => ch.channel_type === 'email') || null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Notification Channels</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Configure how you receive notifications
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchChannels}
          disabled={isLoading}
          className="gap-2 btn-neutral transition-all duration-200"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <div
          className={cn(
            'p-4 rounded-[var(--radius-xl)]',
            'border border-[var(--color-border-critical-faded)]',
            'bg-[var(--color-background-critical-faded)]/20',
            'animate-slideDown'
          )}
        >
          <p className="text-sm text-[var(--text-error)]">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchChannels}
            className="mt-2 btn-neutral transition-all duration-200"
          >
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
          onConfigure={() => handleConfigureChannel('slack')}
        />
        <ChannelCard
          channel={emailChannel}
          channelType="email"
          isLoading={isLoading}
          onToggle={(enabled) => handleToggleChannel('email', enabled)}
          onConfigure={() => handleConfigureChannel('email')}
        />
      </div>

      {!isLoading && channels.length === 0 && !error && (
        <div
          className={cn(
            'card-outline p-6 text-center',
            'transition-all duration-200'
          )}
        >
          <p className="text-[var(--text-secondary)] mb-4">
            No channels configured yet. Configure a channel to start receiving notifications.
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConfigureChannel('slack')}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Configure Slack
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConfigureChannel('email')}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Configure Email
            </Button>
          </div>
        </div>
      )}

      {/* Channel Configuration Dialog */}
      <ChannelConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        channelType={editingChannelType}
        existingChannel={
          editingChannelType === 'slack' ? slackChannel : emailChannel
        }
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}
