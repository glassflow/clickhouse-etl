'use client'

import { TimeRangePicker } from '@/src/components/ui/time-range-picker'
import { ScopeBadge } from '@/src/components/ui/scope-badge'
import { Switch } from '@/src/components/ui/switch'
import { useStore } from '@/src/store'
import { BrushedRangePill } from './BrushedRangePill'

type MetricsToolbarProps = { pipelineId: string }

export function MetricsToolbar({ pipelineId }: MetricsToolbarProps) {
  const { observabilityStore } = useStore()
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
          onChange={observabilityStore.setRangeKey}
        />
      </div>
    </div>
  )
}
