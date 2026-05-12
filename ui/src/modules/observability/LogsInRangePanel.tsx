'use client'

import * as React from 'react'
import { useLogsQuery } from '@/src/hooks/useLogsQuery'

type Props = {
  pipelineId: string
}

type ComponentSummary = {
  total: number
  errors: number
  warns: number
}

/**
 * Render a component breakdown of logs for whatever range is currently
 * active in observabilityStore. When called from DrillDownView this is the
 * brushed range (since `useMetricsRange` prioritises `brushedRange`).
 */
export function LogsInRangePanel({ pipelineId }: Props) {
  const { data, isLoading, error } = useLogsQuery(pipelineId, '')
  const lines = data?.lines ?? []

  const summary = React.useMemo<Record<string, ComponentSummary>>(() => {
    const acc: Record<string, ComponentSummary> = {}
    for (const l of lines) {
      const comp = String(l.component ?? 'unknown')
      acc[comp] ??= { total: 0, errors: 0, warns: 0 }
      acc[comp].total += 1
      const sev = String(l.severity ?? '').toLowerCase()
      if (sev === 'error' || sev === 'fatal') acc[comp].errors += 1
      else if (sev === 'warn' || sev === 'warning') acc[comp].warns += 1
    }
    return acc
  }, [lines])

  const components = Object.keys(summary)

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="caption-1 text-[var(--text-secondary)]">Logs in this range</span>
        <span className="caption-1 mono-2 text-[var(--text-tertiary)]">
          {isLoading ? 'querying…' : `${lines.length} lines`}
        </span>
      </div>
      {error && <p className="caption-1 text-[var(--color-foreground-critical)]">{error.message}</p>}
      {!isLoading && !error && (
        <ul className="flex flex-col gap-1.5">
          {components.map((c) => {
            const s = summary[c]
            return (
              <li key={c} className="flex items-center justify-between caption-1 mono-2">
                <span className="text-[var(--text-primary)]">{c}</span>
                <span className="text-[var(--text-tertiary)]">
                  <span className="text-[var(--color-foreground-critical)]">{s.errors}</span>
                  {' err · '}
                  <span className="text-[var(--obs-severity-warn)]">{s.warns}</span>
                  {' warn · '}
                  {s.total}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
