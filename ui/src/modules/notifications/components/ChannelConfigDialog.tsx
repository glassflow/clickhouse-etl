'use client'

import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { cn } from '@/src/utils/common.client'
import { SlackConfigForm } from './SlackConfigForm'
import { EmailConfigForm } from './EmailConfigForm'
import {
  notificationsApi,
  type Channel,
  type ChannelType,
  type SlackChannelConfig,
  type EmailChannelConfig,
} from '@/src/services/notifications-api'

interface ChannelConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelType: ChannelType
  existingChannel: Channel | null
  onSuccess: () => void
}

/**
 * ChannelConfigDialog Component
 *
 * Modal dialog for creating or editing channel configurations.
 * Renders the appropriate form based on channel type (Slack or Email).
 */
export function ChannelConfigDialog({
  open,
  onOpenChange,
  channelType,
  existingChannel,
  onSuccess,
}: ChannelConfigDialogProps) {
  const [config, setConfig] = useState<SlackChannelConfig | EmailChannelConfig | null>(null)
  const [isValid, setIsValid] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSlack = channelType === 'slack'
  const isEditing = existingChannel !== null
  const title = isEditing
    ? `Edit ${isSlack ? 'Slack' : 'Email'} Configuration`
    : `Configure ${isSlack ? 'Slack' : 'Email'} Channel`

  // Reset state when dialog opens/closes or channel changes
  useEffect(() => {
    if (open) {
      setConfig(null)
      setIsValid(false)
      setError(null)
    }
  }, [open, channelType])

  const handleConfigChange = useCallback(
    (newConfig: SlackChannelConfig | EmailChannelConfig, valid: boolean) => {
      setConfig(newConfig)
      setIsValid(valid)
      setError(null)
    },
    []
  )

  const handleSave = async () => {
    if (!config || !isValid) return

    setIsSaving(true)
    setError(null)

    try {
      const result = await notificationsApi.updateChannel(channelType, {
        enabled: existingChannel?.enabled ?? true,
        config,
      })

      if (result.success) {
        onSuccess()
        onOpenChange(false)
      } else {
        setError(result.error || 'Failed to save channel configuration')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="sm:max-w-[680px] lg:max-w-[800px] form-modal-container surface-gradient-border border-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="modal-description">
            {isEditing
              ? `Update the ${isSlack ? 'Slack webhook' : 'SMTP'} settings for this channel.`
              : `Enter the ${isSlack ? 'Slack webhook' : 'SMTP'} settings to enable notifications.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isSlack ? (
            <SlackConfigForm
              initialConfig={existingChannel?.config as SlackChannelConfig | null}
              onChange={handleConfigChange}
              disabled={isSaving}
            />
          ) : (
            <EmailConfigForm
              initialConfig={existingChannel?.config as EmailChannelConfig | null}
              onChange={handleConfigChange}
              disabled={isSaving}
            />
          )}
        </div>

        {error && (
          <div
            className={cn(
              'p-3 rounded-[var(--radius-md)]',
              'border border-[var(--color-border-critical-faded)]',
              'bg-[var(--color-background-critical-faded)]/20',
              'animate-slideDown'
            )}
          >
            <p className="text-sm text-[var(--color-foreground-critical)]">{error}</p>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button
            variant="tertiary"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="primary" size="custom" className="gap-2"
            onClick={handleSave}
            disabled={!isValid || isSaving}
          >
            {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
