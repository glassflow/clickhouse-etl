'use client'

import * as React from 'react'
import {
  TimeRangePicker,
  type TimeRangeKey,
} from '@/src/components/ui/time-range-picker'
import { ScopeBadge } from '@/src/components/ui/scope-badge'
import { Switch } from '@/src/components/ui/switch'
import { useStore } from '@/src/store'
import { BrushedRangePill } from './BrushedRangePill'
import { CustomDateRangeModal } from './CustomDateRangeModal'

type MetricsToolbarProps = { pipelineId: string }

export function MetricsToolbar({ pipelineId }: MetricsToolbarProps) {
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
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <ScopeBadge pipelineId={pipelineId} />
        <BrushedRangePill />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 caption-1 text-[var(--text-secondary)]">
          Auto-refresh
          <Switch
            checked={observabilityStore.autoRefresh}
            onCheckedChange={observabilityStore.setAutoRefresh}
          />
        </label>
        <TimeRangePicker
          value={observabilityStore.rangeKey}
          onChange={handleRangeChange}
        />
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
    </div>
  )
}
