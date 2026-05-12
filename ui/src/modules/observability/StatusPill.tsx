'use client'

import * as React from 'react'
import type { ObservabilityStackResponse } from '@/src/app/ui-api/observability/stack/route'

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null
  const gb = bytes / 1_000_000_000
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / 1_000_000
  return `${mb.toFixed(0)} MB`
}

export function StatusPill() {
  const [info, setInfo] = React.useState<ObservabilityStackResponse | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch('/ui-api/observability/stack')
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setError(true)
          return
        }
        const data = (await res.json()) as ObservabilityStackResponse
        if (!cancelled) setInfo(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error || !info) return null

  const disk = formatBytes(info.vmsingle?.diskUsageBytes)
  const metricsRetention = info.vmsingle?.retention
  const logsRetention = info.victoriaLogs?.retention
  const parts: string[] = ['internal stack']
  if (disk) parts.push(disk)
  if (metricsRetention) parts.push(`${metricsRetention} / ${logsRetention ?? '—'}`)

  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--surface-bg)] border border-[var(--surface-border)] caption-2 mono-3 text-[var(--text-secondary)]"
      aria-label="Internal observability stack status"
    >
      {parts.join(' · ')}
    </span>
  )
}
