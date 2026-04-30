'use client'

import * as React from 'react'
import { cn } from '@/src/utils/common.client'
import type { LogLine as LogLineType } from '@/src/hooks/useLogsQuery'

const SEVERITY_COLOR: Record<string, string> = {
  debug: 'var(--obs-severity-debug)',
  info: 'var(--obs-severity-info)',
  warn: 'var(--obs-severity-warn)',
  error: 'var(--obs-severity-error)',
  fatal: 'var(--obs-severity-fatal)',
}

type LogLineProps = {
  line: LogLineType
  onClick?: (line: LogLineType) => void
  highlight?: string
  className?: string
}

export function LogLine({ line, onClick, highlight, className }: LogLineProps) {
  const sev = (line.severity ?? 'info').toLowerCase()
  const stripeColor = SEVERITY_COLOR[sev] ?? SEVERITY_COLOR.info

  return (
    <button
      type="button"
      onClick={() => onClick?.(line)}
      className={cn(
        'w-full grid grid-cols-[3px_180px_120px_72px_1fr] items-baseline gap-3 px-2 py-1 text-left',
        'border-l-2 hover:bg-[var(--interactive-hover-bg)] mono-1',
        className,
      )}
      style={{ borderLeftColor: stripeColor }}
    >
      <span aria-hidden="true" />
      <span className="mono-2 text-[var(--text-tertiary)]">{formatTime(line._time)}</span>
      <span className="caption-1 text-[var(--text-secondary)] truncate">
        {line.component ?? '—'}
      </span>
      <span className="caption-2 uppercase tracking-wider" style={{ color: stripeColor }}>
        {sev}
      </span>
      <span className="text-[var(--text-primary)] truncate">
        {highlight ? <Highlighted text={line._msg} term={highlight} /> : line._msg}
      </span>
    </button>
  )
}

function formatTime(t: string): string {
  try {
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return t
    const hms = d.toLocaleTimeString(undefined, { hour12: false })
    const ms = d.getMilliseconds().toString().padStart(3, '0')
    return `${hms}.${ms}`
  } catch {
    return t
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Highlighted({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>
  // Best-effort substring highlight on the visible text. We intentionally
  // do NOT try to parse LogsQL — the user query may have filter-only tokens
  // that won't appear in `_msg`.
  const literal = term.replace(/^["']|["']$/g, '')
  if (!literal.trim()) return <>{text}</>
  const re = new RegExp(`(${escapeRegex(literal)})`, 'gi')
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === literal.toLowerCase() ? (
          <mark
            key={i}
            className="bg-[var(--color-orange-alpha-20)] text-[var(--color-foreground-primary)] rounded px-0.5"
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}
