'use client'

import { PipelinesList } from '@/src/modules/pipelines/PipelinesList'
import { NoPipelines } from '@/src/modules/pipelines/NoPipelines'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { ListPipelineConfig } from '@/src/types/pipeline'
import { WorkflowIcon, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react'
import { useState, useCallback } from 'react'
import { PipelineStatus } from '@/src/types/pipeline'

type DashboardStats = {
  total: number
  running: number
  error: number
}

type DashboardClientProps = {
  initialPipelines: ListPipelineConfig[]
  stats: DashboardStats
}

type StatCardProps = {
  label: string
  value: number
  icon: React.ReactNode
  accent?: 'default' | 'success' | 'error'
}

function StatCard({ label, value, icon, accent = 'default' }: StatCardProps) {
  const accentColor =
    accent === 'success'
      ? 'text-[var(--color-foreground-positive)]'
      : accent === 'error'
        ? 'text-[var(--color-foreground-critical)]'
        : 'text-[var(--color-foreground-primary)]'

  return (
    <Card variant="dark" className="flex items-center gap-4 p-5">
      <span className={accentColor} aria-hidden="true">
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="title-4 font-semibold text-[var(--text-primary)]">{value}</span>
        <span className="caption-1 text-[var(--text-secondary)]">{label}</span>
      </div>
    </Card>
  )
}

export function DashboardClient({ initialPipelines, stats }: DashboardClientProps) {
  const [pipelines, setPipelines] = useState<ListPipelineConfig[]>(initialPipelines)

  const updatePipelineStatus = useCallback((pipelineId: string, status: PipelineStatus) => {
    setPipelines((prev) =>
      prev.map((p) => (p.pipeline_id === pipelineId ? { ...p, status, state: status } : p)),
    )
  }, [])

  const updatePipelineName = useCallback((pipelineId: string, newName: string) => {
    setPipelines((prev) =>
      prev.map((p) => (p.pipeline_id === pipelineId ? { ...p, name: newName } : p)),
    )
  }, [])

  const updatePipelineTags = useCallback((pipelineId: string, tags: string[]) => {
    setPipelines((prev) =>
      prev.map((p) =>
        p.pipeline_id === pipelineId ? { ...p, metadata: { ...(p.metadata || {}), tags } } : p,
      ),
    )
  }, [])

  const removePipeline = useCallback((pipelineId: string) => {
    setPipelines((prev) => prev.filter((p) => p.pipeline_id !== pipelineId))
  }, [])

  return (
    <div className="flex flex-col gap-8 animate-fadeIn">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="title-2 text-[var(--text-primary)]">Dashboard</h1>
        <p className="body-3 text-[var(--text-secondary)]">Overview of your pipelines and their health</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Pipelines"
          value={stats.total}
          icon={<WorkflowIcon size={22} />}
        />
        <StatCard
          label="Running"
          value={stats.running}
          icon={<CheckCircle2Icon size={22} />}
          accent="success"
        />
        <StatCard
          label="Error"
          value={stats.error}
          icon={<AlertCircleIcon size={22} />}
          accent="error"
        />
      </div>

      {/* Pipeline list */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="title-5 text-[var(--text-primary)]">All Pipelines</h2>
          {stats.total > 0 && (
            <Badge variant="secondary">{stats.total}</Badge>
          )}
        </div>

        {pipelines.length > 0 ? (
          <PipelinesList
            pipelines={pipelines}
            onUpdatePipelineStatus={updatePipelineStatus}
            onUpdatePipelineName={updatePipelineName}
            onRemovePipeline={removePipeline}
            onUpdatePipelineTags={updatePipelineTags}
          />
        ) : (
          <NoPipelines />
        )}
      </div>
    </div>
  )
}
