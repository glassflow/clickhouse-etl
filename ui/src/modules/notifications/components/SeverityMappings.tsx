'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  Bug,
  RefreshCw,
  Save,
  Mail,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { cn } from '@/src/utils/common.client'
import {
  notificationsApi,
  type SeverityMapping,
  type SeverityLevel,
  type ChannelType,
} from '@/src/services/notifications-api'

const SEVERITY_CONFIG: Record<
  SeverityLevel,
  { icon: typeof AlertCircle; label: string; colorVar: string; bgColorVar: string }
> = {
  debug: {
    icon: Bug,
    label: 'Debug',
    colorVar: 'var(--text-secondary)',
    bgColorVar: 'var(--color-background-neutral-faded)'
  },
  info: {
    icon: Info,
    label: 'Info',
    colorVar: 'var(--color-foreground-info)',
    bgColorVar: 'var(--color-background-info-faded)'
  },
  warn: {
    icon: AlertTriangle,
    label: 'Warning',
    colorVar: 'var(--color-foreground-warning)',
    bgColorVar: 'var(--color-background-warning-faded)'
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    colorVar: 'var(--color-foreground-critical)',
    bgColorVar: 'var(--color-background-critical-faded)'
  },
  fatal: {
    icon: XCircle,
    label: 'Fatal',
    colorVar: 'var(--color-foreground-critical)',
    bgColorVar: 'var(--color-background-critical-faded)'
  },
}

const SEVERITY_ORDER: SeverityLevel[] = ['debug', 'info', 'warn', 'error', 'fatal']

interface SeverityRowProps {
  severity: SeverityLevel
  channels: ChannelType[]
  onChange: (severity: SeverityLevel, channels: ChannelType[]) => void
  disabled: boolean
}

/**
 * Individual severity mapping row
 */
function SeverityRow({ severity, channels, onChange, disabled }: SeverityRowProps) {
  const config = SEVERITY_CONFIG[severity]
  const Icon = config.icon

  const hasSlack = channels.includes('slack')
  const hasEmail = channels.includes('email')

  const toggleChannel = (channel: ChannelType) => {
    const newChannels = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel]
    onChange(severity, newChannels)
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4',
        'card-outline',
        'transition-all duration-200',
        'hover:shadow-[var(--card-shadow-hover)]'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-[var(--radius-medium)]"
          style={{ backgroundColor: config.bgColorVar }}
        >
          <Icon
            className="h-4 w-4"
            style={{ color: config.colorVar }}
          />
        </div>
        <div>
          <span className="font-medium text-[var(--text-primary)]">{config.label}</span>
          {channels.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)]">No channels selected</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={hasSlack ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleChannel('slack')}
          disabled={disabled}
          className={cn(
            'h-8 gap-1.5',
            'transition-all duration-200',
            !hasSlack && 'btn-neutral'
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Slack
        </Button>
        <Button
          variant={hasEmail ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleChannel('email')}
          disabled={disabled}
          className={cn(
            'h-8 gap-1.5',
            'transition-all duration-200',
            !hasEmail && 'btn-neutral'
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </Button>
      </div>
    </div>
  )
}

/**
 * SeverityMappings Component
 *
 * Allows configuration of which channels receive notifications for each severity level.
 */
export function SeverityMappings() {
  const [mappings, setMappings] = useState<SeverityMapping[]>([])
  const [localMappings, setLocalMappings] = useState<Record<SeverityLevel, ChannelType[]>>({
    debug: [],
    info: [],
    warn: [],
    error: [],
    fatal: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchMappings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const result = await notificationsApi.fetchSeverityMappings()

    if (result.success && result.data) {
      setMappings(result.data.mappings)

      // Build local state from fetched mappings
      const newLocal: Record<SeverityLevel, ChannelType[]> = {
        debug: [],
        info: [],
        warn: [],
        error: [],
        fatal: [],
      }
      result.data.mappings.forEach((m) => {
        newLocal[m.severity] = m.channels
      })
      setLocalMappings(newLocal)
      setHasChanges(false)
    } else {
      setError(result.error || 'Failed to load severity mappings')
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchMappings()
  }, [fetchMappings])

  const handleChange = useCallback((severity: SeverityLevel, channels: ChannelType[]) => {
    setLocalMappings((prev) => ({
      ...prev,
      [severity]: channels,
    }))
    setHasChanges(true)
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    const result = await notificationsApi.updateSeverityMappingsBulk(localMappings)

    if (result.success) {
      setHasChanges(false)
      // Refetch to get updated timestamps
      await fetchMappings()
    } else {
      setError(result.error || 'Failed to save severity mappings')
    }

    setIsSaving(false)
  }

  const handleReset = () => {
    // Reset to original fetched state
    const newLocal: Record<SeverityLevel, ChannelType[]> = {
      debug: [],
      info: [],
      warn: [],
      error: [],
      fatal: [],
    }
    mappings.forEach((m) => {
      newLocal[m.severity] = m.channels
    })
    setLocalMappings(newLocal)
    setHasChanges(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Severity Routing</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Choose which channels receive notifications for each severity level
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
              className="btn-neutral transition-all duration-200"
            >
              Reset
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMappings}
            disabled={isLoading || isSaving}
            className="gap-2 btn-neutral transition-all duration-200"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div
          className={cn(
            'p-4 rounded-[var(--radius-large)]',
            'border border-[var(--color-border-critical-faded)]',
            'bg-[var(--color-background-critical-faded)]/20',
            'animate-slideDown'
          )}
        >
          <p className="text-sm text-[var(--text-error)]">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {SEVERITY_ORDER.map((severity, index) => (
          <div
            key={severity}
            className="animate-fadeIn"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <SeverityRow
              severity={severity}
              channels={localMappings[severity]}
              onChange={handleChange}
              disabled={isLoading || isSaving}
            />
          </div>
        ))}
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div
          className={cn(
            'flex items-center justify-between p-4',
            'rounded-[var(--radius-large)]',
            'bg-[var(--color-background-primary-faded)] border border-[var(--color-border-primary-faded)]',
            'animate-slideDown',
            'transition-all duration-200'
          )}
        >
          <p className="text-sm text-[var(--text-primary)] font-medium">You have unsaved changes</p>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 transition-all duration-200"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      )}

      {/* Legend */}
      <div
        className={cn(
          'p-4 rounded-[var(--radius-large)]',
          'border border-[var(--surface-border)]',
          'bg-[var(--color-background-neutral-faded)]',
          'transition-all duration-200'
        )}
      >
        <p className="text-xs text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">Tip:</strong> Select which channels should receive notifications for each severity level.
          Notifications will only be sent to enabled channels. If no channels are selected for a severity,
          those notifications will not be delivered.
        </p>
      </div>
    </div>
  )
}
