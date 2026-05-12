'use client'

import * as React from 'react'
import { TimeRangePicker, DEFAULT_RANGES, type TimeRangeKey } from '@/src/components/ui/time-range-picker'
import { ScopeBadge } from '@/src/components/ui/scope-badge'
import { useStore } from '@/src/store'
import { AutoRefreshControl } from './AutoRefreshControl'
import { BrushedRangePill } from './BrushedRangePill'
import { CustomDateRangeModal } from './CustomDateRangeModal'
import { MetricsComponentFilter } from './MetricsComponentFilter'
import { StatusPill } from './StatusPill'

type MetricsToolbarProps = { pipelineId: string }

const VALID_KEYS = new Set(DEFAULT_RANGES.map((r) => r.key))

function readRangeFromUrl(): TimeRangeKey | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('range') as TimeRangeKey | null
  return raw && raw !== 'custom' && VALID_KEYS.has(raw) ? raw : null
}

function writeRangeToUrl(key: TimeRangeKey) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('range', key)
  window.history.replaceState({}, '', url.toString())
}

export function MetricsToolbar({ pipelineId }: MetricsToolbarProps) {
  const { observabilityStore } = useStore()
  const [customOpen, setCustomOpen] = React.useState(false)

  // Initialise range from ?range= query param on first mount.
  React.useEffect(() => {
    const fromUrl = readRangeFromUrl()
    if (fromUrl) observabilityStore.setRangeKey(fromUrl)
  }, [])

  const handleRangeChange = (k: TimeRangeKey) => {
    if (k === 'custom') {
      setCustomOpen(true)
      return
    }
    observabilityStore.setRangeKey(k)
    writeRangeToUrl(k)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ScopeBadge pipelineId={pipelineId} />
          <BrushedRangePill />
        </div>
        <div className="flex items-center gap-3">
          <StatusPill />
          <AutoRefreshControl />
          <TimeRangePicker value={observabilityStore.rangeKey} onChange={handleRangeChange} />
        </div>
      </div>
      <MetricsComponentFilter />
      <CustomDateRangeModal
        open={customOpen}
        initialFrom={observabilityStore.customRange ? new Date(observabilityStore.customRange.fromMs) : null}
        initialTo={observabilityStore.customRange ? new Date(observabilityStore.customRange.toMs) : null}
        onClose={() => setCustomOpen(false)}
        onApply={(range) => {
          observabilityStore.setCustomRange(range)
          observabilityStore.setRangeKey('custom')
          setCustomOpen(false)
        }}
      />
    </div>
  )
}
