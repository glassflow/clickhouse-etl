'use client'

import { useMetricsQuery, type MetricResult } from '@/src/hooks/useMetricsQuery'
import { Sparkline } from '@/src/components/ui/sparkline'

type MiniMetricsStripProps = { pipelineId: string }

/**
 * Compact two-sparkline strip (throughput + errors) shown above the LogsTab
 * timeline, so users can correlate log volume with the adjacent metrics
 * without leaving the tab.
 */
export function MiniMetricsStrip({ pipelineId }: MiniMetricsStripProps) {
  const tput = useMetricsQuery(pipelineId, 'records_processed')
  const errs = useMetricsQuery(pipelineId, 'errors_total')

  return (
    <div className="flex items-center gap-4 px-3 py-2 border border-[var(--surface-border)] rounded-md bg-[var(--color-background-elevation-raised-faded)]">
      <Mini label="throughput" data={tput.data} />
      <Mini label="errors" data={errs.data} stroke="var(--obs-severity-error)" />
    </div>
  )
}

function Mini({
  label,
  data,
  stroke,
}: {
  label: string
  data?: MetricResult
  stroke?: string
}) {
  const series = data?.result?.result?.[0]?.values ?? []
  const numerics = series.map((p) => parseFloat(p[1])).filter((v) => Number.isFinite(v))
  return (
    <div className="flex items-center gap-2">
      <span className="caption-1 text-[var(--text-tertiary)]">{label}</span>
      <Sparkline data={numerics} width={80} height={20} stroke={stroke} />
    </div>
  )
}
