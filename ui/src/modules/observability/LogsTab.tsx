'use client'

import * as React from 'react'
import { LogsToolbar } from './LogsToolbar'
import { LogLine } from './LogLine'
import { LogInspectorDrawer } from './LogInspectorDrawer'
import { FilterPillRow } from './FilterPillRow'
import { MiniMetricsStrip } from './MiniMetricsStrip'
import { DisabledState } from './DisabledState'
import { ContextExpander } from './ContextExpander'
import { clusterLogs } from './ContextClusterer'
import { useLogStream } from '@/src/hooks/useLogStream'
import { useLogsQuery, type LogLine as LogLineType } from '@/src/hooks/useLogsQuery'
import { useObservabilityFlag } from '@/src/hooks/useObservabilityFlag'
import { useStore } from '@/src/store'
import { EmptyState } from '@/src/components/ui/empty-state'

type LogsTabProps = { pipelineId: string }

const ALL_SEVERITIES = ['debug', 'info', 'warn', 'error', 'fatal'] as const
type Severity = (typeof ALL_SEVERITIES)[number]

const SEVERITY_COLORS: Record<Severity, string> = {
  debug: 'var(--obs-severity-debug)',
  info: 'var(--obs-severity-info)',
  warn: 'var(--obs-severity-warn)',
  error: 'var(--obs-severity-error)',
  fatal: 'var(--obs-severity-fatal)',
}

/**
 * Per-pipeline Logs tab.
 *
 * - Default mode: live tail via SSE (`useLogStream`)
 * - Range mode (auto): when the user pins a brushed range from Metrics, the
 *   tab switches to range-query mode (`useLogsQuery`) and the SSE connection
 *   is suspended. Clearing the pinned range returns to live tail.
 * - Filters: severity (5 fixed) + component (auto-discovered from buffer)
 * - Search: LogsQL string committed on ⌘/Ctrl+Enter
 * - Inspector: click any line → right-side drawer with structured fields
 */
export function LogsTab({ pipelineId }: LogsTabProps) {
  const { observabilityStore } = useStore()
  const enabled = useObservabilityFlag()

  const [query, setQuery] = React.useState('')
  const [committedQuery, setCommittedQuery] = React.useState('')
  const [paused, setPaused] = React.useState(false)
  const [inspector, setInspector] = React.useState<LogLineType | null>(null)
  const [selectedSeverities, setSelectedSeverities] = React.useState<Severity[]>([
    ...ALL_SEVERITIES,
  ])
  const [selectedComponents, setSelectedComponents] = React.useState<string[]>([])

  const usingRange = !!observabilityStore.brushedRange
  // Switch from live tail to range-query mode when a range is pinned.
  const range = useLogsQuery(pipelineId, committedQuery, { skip: !usingRange })
  const stream = useLogStream(pipelineId, committedQuery, paused || usingRange)

  const allLines: LogLineType[] = usingRange ? (range.data?.lines ?? []) : stream.lines

  const components = React.useMemo(
    () => Array.from(new Set(allLines.map((l) => String(l.component ?? 'unknown')))).sort(),
    [allLines],
  )

  // Auto-select all newly-discovered components on first sighting; existing
  // selections are preserved so the user's manual deselections aren't reset
  // every time a new component appears.
  React.useEffect(() => {
    setSelectedComponents((prev) => {
      const known = new Set(prev)
      let changed = false
      for (const c of components) {
        if (!known.has(c)) {
          known.add(c)
          changed = true
        }
      }
      return changed ? Array.from(known) : prev
    })
  }, [components])

  const filtered = React.useMemo(
    () =>
      allLines.filter((l) => {
        const sev = String(l.severity ?? 'info').toLowerCase()
        if (!selectedSeverities.includes(sev as Severity)) return false
        const comp = String(l.component ?? 'unknown')
        if (selectedComponents.length > 0 && !selectedComponents.includes(comp)) return false
        return true
      }),
    [allLines, selectedSeverities, selectedComponents],
  )

  const sevCounts = React.useMemo(
    () =>
      countBy(allLines, (l) => String(l.severity ?? 'info').toLowerCase()) as Record<
        Severity,
        number
      >,
    [allLines],
  )
  const compCounts = React.useMemo(
    () => countBy(allLines, (l) => String(l.component ?? 'unknown')),
    [allLines],
  )

  // Expanded gap clusters — when ContextExpander is clicked, the gap key is
  // added to this set and the LogsTab re-renders the underlying lines inline
  // instead of the placeholder.
  const [expandedGaps, setExpandedGaps] = React.useState<Set<string>>(new Set())

  // Reset expansions whenever the committed query or buffer length changes —
  // otherwise old gap keys leak into a fresh result set.
  React.useEffect(() => {
    setExpandedGaps(new Set())
  }, [committedQuery, allLines.length])

  const cluster = React.useMemo(
    () => clusterLogs(filtered, committedQuery, 5),
    [filtered, committedQuery],
  )

  const toggleSev = React.useCallback(
    (k: Severity) =>
      setSelectedSeverities((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])),
    [],
  )
  const toggleComp = React.useCallback(
    (k: string) =>
      setSelectedComponents((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])),
    [],
  )

  if (!enabled) {
    return <DisabledState surface="logs" />
  }

  const errorMsg = usingRange ? range.error?.message : stream.error
  const isLive = stream.connected || usingRange

  return (
    <div className="flex flex-col gap-3 h-full">
      <LogsToolbar
        pipelineId={pipelineId}
        query={query}
        onQueryChange={setQuery}
        onSearch={() => setCommittedQuery(query)}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        matchCount={filtered.length}
        connected={isLive}
      />

      <MiniMetricsStrip pipelineId={pipelineId} />

      <FilterPillRow<Severity>
        label="Severity"
        options={[...ALL_SEVERITIES]}
        counts={sevCounts}
        selected={selectedSeverities}
        onToggle={toggleSev}
        swatchColors={SEVERITY_COLORS}
      />

      {components.length > 0 && (
        <FilterPillRow
          label="Component"
          options={components}
          counts={compCounts}
          selected={selectedComponents}
          onToggle={toggleComp}
        />
      )}

      {errorMsg && filtered.length > 0 && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-[var(--color-foreground-critical-faded)] bg-[var(--color-background-critical-faded)]"
        >
          <span className="caption-1 text-[var(--color-foreground-critical)]">{errorMsg}</span>
          <button
            type="button"
            onClick={() => (usingRange ? range.mutate() : stream.clear())}
            className="caption-1 text-[var(--color-foreground-primary)] underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-base)] overflow-y-auto">
        {errorMsg && filtered.length === 0 ? (
          <EmptyState
            heading="Failed to load logs"
            copy={errorMsg}
            cta={{ label: 'Retry', onClick: () => (usingRange ? range.mutate() : stream.clear()) }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            heading="No log lines"
            copy={
              usingRange
                ? 'No log lines match the current filters in the pinned range.'
                : paused
                  ? 'Live tail is paused. Resume to start streaming.'
                  : 'Waiting for log lines from the pipeline.'
            }
          />
        ) : (
          <ul className="flex flex-col">
            {cluster.flatMap((item, i) => {
              if (item.kind === 'line') {
                return [
                  <li key={`l-${item.index}-${item.line._time}`}>
                    <LogLine
                      line={item.line}
                      highlight={committedQuery}
                      onClick={setInspector}
                    />
                  </li>,
                ]
              }
              const gapKey = `${item.startIndex}-${item.endIndex}`
              if (expandedGaps.has(gapKey)) {
                return filtered
                  .slice(item.startIndex, item.endIndex + 1)
                  .map((l, j) => (
                    <li key={`l-exp-${gapKey}-${j}-${l._time}`}>
                      <LogLine line={l} highlight={committedQuery} onClick={setInspector} />
                    </li>
                  ))
              }
              return [
                <li key={`g-${i}-${gapKey}`}>
                  <ContextExpander
                    collapsedCount={item.collapsedCount}
                    onExpand={() =>
                      setExpandedGaps((s) => {
                        const next = new Set(s)
                        next.add(gapKey)
                        return next
                      })
                    }
                  />
                </li>,
              ]
            })}
          </ul>
        )}
      </div>

      <LogInspectorDrawer
        line={inspector}
        pipelineId={pipelineId}
        onClose={() => setInspector(null)}
      />
    </div>
  )
}

function countBy<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, x) => {
    const k = key(x)
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
}
