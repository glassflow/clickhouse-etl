'use client'

import * as React from 'react'
import { PauseIcon, PlayIcon, SearchIcon } from 'lucide-react'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { LiveIndicator } from '@/src/components/ui/live-indicator'
import { ScopeBadge } from '@/src/components/ui/scope-badge'
import {
  TimeRangePicker,
  type TimeRangeKey,
} from '@/src/components/ui/time-range-picker'
import { KbdHint } from '@/src/components/ui/kbd-hint'
import { useStore } from '@/src/store'
import { BrushedRangePill } from './BrushedRangePill'
import { CustomDateRangeModal } from './CustomDateRangeModal'

type LogsToolbarProps = {
  pipelineId: string
  query: string
  onQueryChange: (q: string) => void
  onSearch: () => void
  paused: boolean
  onTogglePause: () => void
  matchCount: number
  connected: boolean
}

/**
 * Logs surface toolbar — scope badge, live indicator, brushed-range pill,
 * time range picker, pause/resume button, and the LogsQL search input.
 *
 * The search input commits on `⌘+Enter` / `Ctrl+Enter` so the user can iterate
 * on the query string without firing a request on every keystroke.
 */
export function LogsToolbar({
  pipelineId,
  query,
  onQueryChange,
  onSearch,
  paused,
  onTogglePause,
  matchCount,
  connected,
}: LogsToolbarProps) {
  const { observabilityStore } = useStore()
  const [customOpen, setCustomOpen] = React.useState(false)

  const handleRangeChange = (k: TimeRangeKey) => {
    if (k === 'custom') {
      setCustomOpen(true)
      return
    }
    observabilityStore.setRangeKey(k)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ScopeBadge pipelineId={pipelineId} />
          <LiveIndicator
            active={!paused && connected}
            label={paused ? 'paused' : connected ? 'live' : 'connecting'}
          />
          <BrushedRangePill />
        </div>
        <div className="flex items-center gap-2">
          <TimeRangePicker
            value={observabilityStore.rangeKey}
            onChange={handleRangeChange}
          />
          <Button variant="secondary" size="sm" onClick={onTogglePause}>
            {paused ? (
              <PlayIcon size={12} className="mr-1.5" />
            ) : (
              <PauseIcon size={12} className="mr-1.5" />
            )}
            {paused ? 'Resume' : 'Pause'}
          </Button>
        </div>
      </div>
      <CustomDateRangeModal
        open={customOpen}
        initialFrom={
          observabilityStore.customRange
            ? new Date(observabilityStore.customRange.fromMs)
            : null
        }
        initialTo={
          observabilityStore.customRange
            ? new Date(observabilityStore.customRange.toMs)
            : null
        }
        onClose={() => setCustomOpen(false)}
        onApply={(range) => {
          observabilityStore.setCustomRange(range)
          observabilityStore.setRangeKey('custom')
          setCustomOpen(false)
        }}
      />

      <div className="relative">
        <SearchIcon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
          aria-hidden="true"
        />
        <Input
          className="pl-8 pr-32 mono-1"
          placeholder='LogsQL search — e.g. severity:error _msg:"timeout"'
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onSearch()
            }
          }}
          aria-label="LogsQL search"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 caption-1 mono-2 text-[var(--text-tertiary)] flex items-center">
          <span className="mr-2">{matchCount} matches</span>
          <KbdHint keys={['⌘', 'Enter']} />
        </span>
      </div>
    </div>
  )
}
