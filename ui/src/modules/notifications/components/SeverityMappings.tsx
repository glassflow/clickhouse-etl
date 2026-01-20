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
  Check,
  BellOff,
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

interface ChannelToggleButtonProps {
  channel: ChannelType
  isEnabled: boolean
  onClick: () => void
  disabled: boolean
}

/**
 * Large channel toggle button with clear enabled/disabled visual states
 */
function ChannelToggleButton({ channel, isEnabled, onClick, disabled }: ChannelToggleButtonProps) {
  const isSlack = channel === 'slack'
  const Icon = isSlack ? MessageSquare : Mail
  const label = isSlack ? 'Slack' : 'Email'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-between p-3',
        'rounded-[var(--radius-medium)]',
        'border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-border-primary)] focus:ring-offset-1',
        disabled && 'opacity-50 cursor-not-allowed',
        isEnabled
          ? [
            'bg-[var(--color-background-primary-faded)]',
            'border-[var(--color-border-primary)]',
            'hover:bg-[var(--color-background-primary-faded)]/80',
          ]
          : [
            'bg-[var(--color-background-neutral-faded)]/50',
            'border-[var(--surface-border)]',
            'hover:bg-[var(--color-background-neutral-faded)]',
            'hover:border-[var(--card-outline-border-hover)]',
          ]
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'p-2 rounded-[var(--radius-small)]',
            'transition-all duration-200',
            isEnabled
              ? 'bg-[var(--color-background-primary)] text-white'
              : 'bg-[var(--color-background-neutral-faded)] text-[var(--text-secondary)]'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span
          className={cn(
            'font-medium transition-colors duration-200',
            isEnabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
          )}
        >
          {label}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          'transition-all duration-200',
          isEnabled
            ? 'bg-[var(--color-background-primary)] text-white'
            : 'bg-transparent text-[var(--text-secondary)]'
        )}
      >
        {isEnabled ? (
          <>
            <Check className="h-3 w-3" />
            Enabled
          </>
        ) : (
          'Disabled'
        )}
      </div>
    </button>
  )
}

interface SeverityCardProps {
  severity: SeverityLevel
  channels: ChannelType[]
  onChange: (severity: SeverityLevel, channels: ChannelType[]) => void
  disabled: boolean
}

/**
 * Individual severity card with vertical layout
 */
function SeverityCard({ severity, channels, onChange, disabled }: SeverityCardProps) {
  const config = SEVERITY_CONFIG[severity]
  const Icon = config.icon

  const hasSlack = channels.includes('slack')
  const hasEmail = channels.includes('email')
  const isFullyDisabled = channels.length === 0

  const toggleChannel = (channel: ChannelType) => {
    const newChannels = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel]
    onChange(severity, newChannels)
  }

  return (
    <div
      className={cn(
        'content-card relative p-5 flex flex-col gap-4',
        'transition-all duration-200',
        'hover:shadow-[var(--card-shadow-hover)]',
        // Card-level disabled styling when no channels are selected
        isFullyDisabled && [
          'bg-[var(--color-background-neutral-faded)]/40',
          'border-[var(--surface-border)]',
          'opacity-75',
        ]
      )}
    >
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2.5 rounded-[var(--radius-medium)]',
              'transition-all duration-200'
            )}
            style={{ backgroundColor: config.bgColorVar }}
          >
            <Icon
              className="h-5 w-5"
              style={{ color: config.colorVar }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">{config.label}</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {isFullyDisabled
                ? 'No notifications'
                : `${channels.length} channel${channels.length !== 1 ? 's' : ''} enabled`}
            </p>
          </div>
        </div>
        {isFullyDisabled && (
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <BellOff className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Channel toggle buttons section */}
      <div className="flex flex-col gap-2">
        <ChannelToggleButton
          channel="slack"
          isEnabled={hasSlack}
          onClick={() => toggleChannel('slack')}
          disabled={disabled}
        />
        <ChannelToggleButton
          channel="email"
          isEnabled={hasEmail}
          onClick={() => toggleChannel('email')}
          disabled={disabled}
        />
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

      {/* Responsive grid of severity cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {SEVERITY_ORDER.map((severity, index) => (
          <div
            key={severity}
            className="animate-fadeIn"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <SeverityCard
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
