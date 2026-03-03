'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { cn } from '@/src/utils/common.client'
import type { SlackChannelConfig } from '@/src/services/notifications-api'

interface SlackConfigFormProps {
  initialConfig?: SlackChannelConfig | null
  onChange: (config: SlackChannelConfig, isValid: boolean) => void
  disabled?: boolean
}

/**
 * SlackConfigForm Component
 *
 * Form for configuring Slack webhook settings.
 * Validates webhook URL format and reports validity to parent.
 */
export function SlackConfigForm({ initialConfig, onChange, disabled }: SlackConfigFormProps) {
  const [webhookUrl, setWebhookUrl] = useState(initialConfig?.webhook_url || '')
  const [defaultChannel, setDefaultChannel] = useState(initialConfig?.default_channel || '')
  const [showWebhook, setShowWebhook] = useState(false)
  const [errors, setErrors] = useState<{ webhookUrl?: string }>({})
  const [touched, setTouched] = useState<{ webhookUrl?: boolean }>({})

  // Validate and notify parent on changes
  useEffect(() => {
    const newErrors: { webhookUrl?: string } = {}

    // Validate webhook URL
    if (!webhookUrl.trim()) {
      newErrors.webhookUrl = 'Webhook URL is required'
    } else if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      newErrors.webhookUrl = 'Must be a valid Slack webhook URL (https://hooks.slack.com/...)'
    }

    setErrors(newErrors)

    const isValid = Object.keys(newErrors).length === 0
    const config: SlackChannelConfig = {
      webhook_url: webhookUrl.trim(),
      ...(defaultChannel.trim() && { default_channel: defaultChannel.trim() }),
    }

    onChange(config, isValid)
  }, [webhookUrl, defaultChannel, onChange])

  // Reset form when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setWebhookUrl(initialConfig.webhook_url || '')
      setDefaultChannel(initialConfig.default_channel || '')
    }
  }, [initialConfig])

  const handleBlur = (field: 'webhookUrl') => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--surface-border)]">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-background-primary-faded)]">
          <MessageSquare className="h-5 w-5 text-[var(--color-foreground-primary)]" />
        </div>
        <div>
          <h3 className="font-medium text-[var(--color-foreground-neutral)]">Slack Configuration</h3>
          <p className="text-sm text-[var(--color-foreground-neutral-faded)]">
            Configure Slack webhook for notifications
          </p>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="grid gap-2">
        <Label htmlFor="webhook_url" className="text-sm text-[var(--color-foreground-neutral-faded)]">
          Webhook URL <span className="text-[var(--color-foreground-critical)]">*</span>
        </Label>
        <div className="relative">
          <Input
            id="webhook_url"
            type={showWebhook ? 'text' : 'password'}
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            onBlur={() => handleBlur('webhookUrl')}
            placeholder="https://hooks.slack.com/services/..."
            disabled={disabled}
            error={!!(touched.webhookUrl && errors.webhookUrl)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowWebhook(!showWebhook)}
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2',
              'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]',
              'transition-colors duration-200'
            )}
            disabled={disabled}
          >
            {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {touched.webhookUrl && errors.webhookUrl && (
          <p className="text-sm input-description-error animate-slideDown">{errors.webhookUrl}</p>
        )}
        <p className="text-sm text-[var(--color-foreground-neutral-faded)]">
          Get your webhook URL from{' '}
          <a
            href="https://api.slack.com/messaging/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-foreground-primary)] hover:underline"
          >
            Slack App settings
          </a>
        </p>
      </div>

      {/* Default Channel */}
      <div className="grid gap-2">
        <Label htmlFor="default_channel" className="text-sm text-[var(--color-foreground-neutral-faded)]">
          Default Channel <span className="text-[var(--color-foreground-neutral-faded)]">(optional)</span>
        </Label>
        <Input
          id="default_channel"
          type="text"
          value={defaultChannel}
          onChange={(e) => setDefaultChannel(e.target.value)}
          placeholder="#notifications"
          disabled={disabled}
        />
        <p className="text-sm text-[var(--color-foreground-neutral-faded)]">Override the default channel configured in your webhook</p>
      </div>
    </div>
  )
}
