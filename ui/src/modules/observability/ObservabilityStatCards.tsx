import { CheckCircle2Icon, AlertCircleIcon, PauseCircleIcon, InboxIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import type { ListPipelineConfig } from '@/src/types/pipeline'
import { isDegraded } from './pipeline-health'

type Props = { pipelines: ListPipelineConfig[] }

export function ObservabilityStatCards({ pipelines }: Props) {
  const running = pipelines.filter((p) => p.status === 'active').length
  const degraded = pipelines.filter(isDegraded).length
  const paused = pipelines.filter((p) => p.status === 'paused' || p.status === 'pausing').length
  const totalDlq = pipelines.reduce((n, p) => n + (p.dlq_stats?.unconsumed_messages ?? 0), 0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Running"
        value={running}
        icon={<CheckCircle2Icon size={15} />}
        valueClass="text-[var(--color-foreground-positive)]"
      />
      <StatCard
        label="Needs attention"
        value={degraded}
        icon={<AlertCircleIcon size={15} />}
        valueClass={degraded > 0 ? 'text-[var(--color-foreground-critical)]' : 'text-[var(--text-secondary)]'}
      />
      <StatCard
        label="Paused"
        value={paused}
        icon={<PauseCircleIcon size={15} />}
        valueClass="text-[var(--text-secondary)]"
      />
      <StatCard
        label="DLQ backlog"
        value={totalDlq}
        icon={<InboxIcon size={15} />}
        valueClass={totalDlq > 0 ? 'text-[var(--color-foreground-critical)]' : 'text-[var(--text-secondary)]'}
        sub="unconsumed msgs"
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  valueClass,
  sub,
}: {
  label: string
  value: number
  icon: React.ReactNode
  valueClass?: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-bg)] px-4 py-4">
      <div className="flex items-center gap-1.5 caption-1 text-[var(--text-tertiary)]">
        <span className="shrink-0">{icon}</span>
        {label}
      </div>
      <div className={cn('title-3', valueClass)}>{value}</div>
      {sub && <p className="caption-2 text-[var(--text-tertiary)] -mt-1">{sub}</p>}
    </div>
  )
}
