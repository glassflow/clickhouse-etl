'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import type { Notification, NotificationSeverity } from '@/src/services/notifications-api'

interface NotificationChannelConfigProps {
  pipelineId: string
}

function severityVariant(s: NotificationSeverity): 'error' | 'warning' | 'secondary' {
  if (s === 'error' || s === 'fatal') return 'error'
  if (s === 'warn') return 'warning'
  return 'secondary'
}

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export function NotificationChannelConfig({ pipelineId }: NotificationChannelConfigProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [disabled, setDisabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/ui-api/notifications?pipeline_id=${encodeURIComponent(pipelineId)}&limit=10`)
      .then(async (res) => {
        if (res.status === 403) { setDisabled(true); return }
        if (!res.ok) return
        const data = await res.json()
        const items: Notification[] = data?.notifications ?? data ?? []
        setNotifications(Array.isArray(items) ? items : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [pipelineId])

  return (
    <Card variant="dark" className="p-4 flex flex-col gap-3">
      <h3 className="title-5 text-[var(--text-primary)]">Recent Notifications</h3>

      {loading && <p className="body-3 text-[var(--text-secondary)]">Loading…</p>}

      {!loading && disabled && (
        <p className="body-3 text-[var(--text-secondary)]">Notifications are not configured for this environment.</p>
      )}

      {!loading && !disabled && notifications.length === 0 && (
        <p className="body-3 text-[var(--text-secondary)]">No recent notifications.</p>
      )}

      {!loading && !disabled && notifications.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.notification_id} className="flex items-start gap-2">
              <Badge variant={severityVariant(n.severity)} className="shrink-0 mt-0.5">
                {n.severity}
              </Badge>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="body-3 text-[var(--text-primary)] truncate">{n.title}</span>
                <span className="caption-1 text-[var(--text-secondary)]">{formatTs(n.timestamp)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
