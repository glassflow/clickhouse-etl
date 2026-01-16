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
  { icon: typeof AlertCircle; label: string; color: string; bgColor: string }
> = {
  debug: { icon: Bug, label: 'Debug', color: 'text-gray-500', bgColor: 'bg-gray-500/10' },
  info: { icon: Info, label: 'Info', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  warn: { icon: AlertTriangle, label: 'Warning', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  error: { icon: AlertCircle, label: 'Error', color: 'text-red-400', bgColor: 'bg-red-400/10' },
  fatal: { icon: XCircle, label: 'Fatal', color: 'text-red-600', bgColor: 'bg-red-600/10' },
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
    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <div>
          <span className="font-medium">{config.label}</span>
          {channels.length === 0 && (
            <p className="text-xs text-muted-foreground">No channels selected</p>
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
            hasSlack && 'bg-primary hover:bg-primary/90',
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
            hasEmail && 'bg-primary hover:bg-primary/90',
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Severity Routing</h2>
          <p className="text-sm text-muted-foreground">
            Choose which channels receive notifications for each severity level
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
              Reset
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMappings}
            disabled={isLoading || isSaving}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-destructive/30 bg-destructive/10 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {SEVERITY_ORDER.map((severity) => (
          <SeverityRow
            key={severity}
            severity={severity}
            channels={localMappings[severity]}
            onChange={handleChange}
            disabled={isLoading || isSaving}
          />
        ))}
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">You have unsaved changes</p>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
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
      <div className="p-4 border border-border rounded-lg bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Select which channels should receive notifications for each severity level.
          Notifications will only be sent to enabled channels. If no channels are selected for a severity,
          those notifications will not be delivered.
        </p>
      </div>
    </div>
  )
}
