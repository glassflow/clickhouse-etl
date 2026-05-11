'use client'

import { ListPipelineConfig, PipelineStatus } from '@/src/types/pipeline'
import { TableColumn } from '@/src/modules/pipelines/PipelinesTable'
import { TableContextMenu } from '@/src/modules/pipelines/TableContextMenu'
import { formatNumber } from '@/src/utils/common.client'
import { SparklineMini } from '@/src/modules/pipelines/components/SparklineMini'
import { enrichPipeline, type PipelineEnv } from '@/src/modules/pipelines/utils/enrichPipelineStubs'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'

// ─── Public config type ───────────────────────────────────────────────────────

export interface PipelineListColumnsConfig {
  isPipelineLoading: (pipelineId: string) => boolean
  getPipelineOperation: (pipelineId: string) => string | null
  getEffectiveStatus: (pipeline: ListPipelineConfig) => PipelineStatus
  onStop: (pipeline: ListPipelineConfig) => void
  onResume: (pipeline: ListPipelineConfig) => void
  onEdit: (pipeline: ListPipelineConfig) => void
  onRename: (pipeline: ListPipelineConfig) => void
  onTerminate: (pipeline: ListPipelineConfig) => void
  onDelete: (pipeline: ListPipelineConfig) => void
  onDownload: (pipeline: ListPipelineConfig) => void
  onManageTags: (pipeline: ListPipelineConfig) => void
  onToggleSelect: (pipelineId: string) => void
  isSelected: (pipelineId: string) => boolean
}

// ─── Status display ───────────────────────────────────────────────────────────

function StatusCell({ pipeline, effectiveStatus }: { pipeline: ListPipelineConfig; effectiveStatus: PipelineStatus }) {
  const isError    = effectiveStatus === 'failed'
  const isWarn     = pipeline.health_status === 'unstable' && !isError
  const isRunning  = effectiveStatus === 'active' && !isWarn
  const isTransit  = effectiveStatus === 'pausing' || effectiveStatus === 'resuming' || effectiveStatus === 'stopping'

  let dotColor: string
  let textColor: string
  let label: string

  if (isError) {
    dotColor = 'var(--color-foreground-critical)'
    textColor = 'var(--color-foreground-critical)'
    label = 'error'
  } else if (isWarn) {
    dotColor = 'var(--color-foreground-warning)'
    textColor = 'var(--color-foreground-warning)'
    label = 'warn'
  } else if (isRunning) {
    dotColor = 'var(--color-foreground-positive)'
    textColor = 'var(--color-foreground-neutral-faded)'
    label = 'running'
  } else if (isTransit) {
    dotColor = 'var(--color-foreground-warning)'
    textColor = 'var(--color-foreground-warning)'
    label = effectiveStatus.replace('ing', '...')
  } else {
    dotColor = 'var(--color-foreground-neutral-faded)'
    textColor = 'var(--color-foreground-neutral-faded)'
    label = effectiveStatus === 'stopped' ? 'stopped' : effectiveStatus
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: dotColor }}
        data-status={effectiveStatus}
      />
      <span className="font-mono caption-1" style={{ color: textColor }}>
        {label}
      </span>
    </div>
  )
}

// ─── Type glyphs ─────────────────────────────────────────────────────────────

const GLYPH_DEFS: { flag: string; label: string; color: string }[] = [
  { flag: 'ingest',     label: 'I', color: 'var(--color-foreground-info)' },
  { flag: 'join',       label: 'J', color: 'var(--color-foreground-warning)' },
  { flag: 'dedup',      label: 'D', color: 'var(--color-purple-300)' },
  { flag: 'filter',     label: 'F', color: 'var(--color-foreground-positive)' },
  { flag: 'transform',  label: 'T', color: 'var(--color-foreground-primary)' },
]

function TypeCell({ transformationType }: { transformationType: string }) {
  const t = (transformationType || '').toLowerCase()
  const active = GLYPH_DEFS.filter(({ flag }) => t.includes(flag) || flag === 'ingest')
  return (
    <div className="flex items-center gap-0.5">
      {active.map(({ label, color }) => (
        <span
          key={label}
          className="font-mono text-[11px] font-bold w-4 h-4 flex items-center justify-center rounded-sm shrink-0"
          style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

// ─── ENV badge ────────────────────────────────────────────────────────────────

const ENV_STYLES: Record<PipelineEnv, { bg: string; fg: string; border: string }> = {
  PROD:    { bg: 'var(--color-background-neutral-faded)',            fg: 'var(--color-foreground-neutral-faded)',  border: 'var(--surface-border)' },
  STAGING: { bg: 'color-mix(in srgb,var(--color-yellow-400) 12%,transparent)', fg: 'var(--color-yellow-400)', border: 'color-mix(in srgb,var(--color-yellow-400) 30%,transparent)' },
  DEV:     { bg: 'color-mix(in srgb,var(--color-foreground-info) 12%,transparent)', fg: 'var(--color-foreground-info)', border: 'color-mix(in srgb,var(--color-foreground-info) 30%,transparent)' },
}

function EnvBadge({ env }: { env: PipelineEnv }) {
  const s = ENV_STYLES[env]
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded caption-2 font-mono font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {env}
    </span>
  )
}

// ─── Owner avatar ─────────────────────────────────────────────────────────────

function OwnerCell({ name, team, initials, colorToken }: { name: string; team: string; initials: string; colorToken: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold"
        style={{ background: colorToken, color: 'var(--color-background-default, #0a0a0a)' }}
        title={name}
      >
        {initials}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="caption-1 text-[var(--table-fg)] truncate leading-tight">{name}</span>
        <span className="font-mono text-[9px] text-[var(--color-foreground-neutral-faded)] truncate leading-tight">{team}</span>
      </div>
    </div>
  )
}

// ─── Tags (compact) ───────────────────────────────────────────────────────────

function TagsCell({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) {
    return <span className="caption-1 text-[var(--color-foreground-neutral-faded)]">—</span>
  }
  const visible  = tags.slice(0, 2)
  const overflow = tags.length - visible.length
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span
          key={tag}
          className="caption-2 font-mono px-1.5 py-0.5 rounded border text-[var(--color-foreground-neutral-faded)]"
          style={{ background: 'var(--color-background-neutral-faded)', borderColor: 'var(--surface-border)' }}
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="caption-2 text-[var(--color-foreground-neutral-faded)]">+{overflow}</span>
      )}
    </div>
  )
}

// ─── Column factory ───────────────────────────────────────────────────────────

export function getPipelineListColumns(config: PipelineListColumnsConfig): TableColumn<ListPipelineConfig>[] {
  const {
    isPipelineLoading,
    getEffectiveStatus,
    onStop, onResume, onEdit, onRename, onTerminate, onDelete, onDownload, onManageTags,
    onToggleSelect, isSelected,
  } = config

  return [
    // ── Select ─────────────────────────────────────────────────────────────
    {
      key: 'select',
      header: '',
      width: '36px',
      sortable: false,
      render: (pipeline) => (
        <div
          className="flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(pipeline.pipeline_id) }}
        >
          <input
            type="checkbox"
            checked={isSelected(pipeline.pipeline_id)}
            onChange={() => {}}
            className="w-3.5 h-3.5 cursor-pointer accent-[var(--color-foreground-primary)]"
          />
        </div>
      ),
    },

    // ── Status ─────────────────────────────────────────────────────────────
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      sortable: true,
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        const isLoading = isPipelineLoading(pipeline.pipeline_id)
        return (
          <div className="flex items-center gap-1.5">
            {isLoading && <Image src={Loader} alt="" width={12} height={12} className="animate-spin shrink-0" />}
            <StatusCell pipeline={pipeline} effectiveStatus={effectiveStatus} />
          </div>
        )
      },
    },

    // ── Name ───────────────────────────────────────────────────────────────
    {
      key: 'name',
      header: 'Name',
      width: 'minmax(140px,2fr)',
      sortable: true,
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        const stubs = enrichPipeline(pipeline, effectiveStatus)
        const isFailed  = effectiveStatus === 'failed'
        return (
          <div className="flex flex-col gap-0 min-w-0">
            <span className="title-6 text-[var(--table-fg)] truncate">{pipeline.name}</span>
            {stubs.diagnostic && (
              <span
                className="font-mono caption-2 truncate"
                style={{ color: isFailed ? 'var(--color-foreground-critical)' : 'var(--color-foreground-warning)' }}
              >
                {stubs.diagnostic}
              </span>
            )}
          </div>
        )
      },
    },

    // ── Type ───────────────────────────────────────────────────────────────
    {
      key: 'type',
      header: 'Type',
      width: '96px',
      sortable: true,
      sortKey: 'transformation_type',
      render: (pipeline) => <TypeCell transformationType={pipeline.transformation_type || ''} />,
    },

    // ── Env ────────────────────────────────────────────────────────────────
    {
      key: 'env',
      header: 'Env',
      width: '68px',
      sortable: false,
      render: (pipeline) => {
        const stubs = enrichPipeline(pipeline, getEffectiveStatus(pipeline))
        return <EnvBadge env={stubs.env} />
      },
    },

    // ── Source → Sink ──────────────────────────────────────────────────────
    {
      key: 'sourceToSink',
      header: 'Source → Sink',
      width: 'minmax(180px,3fr)',
      sortable: false,
      render: (pipeline) => {
        const stubs = enrichPipeline(pipeline, getEffectiveStatus(pipeline))
        const full  = `${stubs.sourceLabel} → ${stubs.sinkLabel}`
        return (
          <span
            className="font-mono caption-1 text-[var(--color-foreground-neutral-faded)] truncate block"
            title={full}
          >
            {stubs.sourceLabel}
            <span className="opacity-40 mx-1">→</span>
            {stubs.sinkLabel}
          </span>
        )
      },
    },

    // ── Throughput ─────────────────────────────────────────────────────────
    {
      key: 'throughput',
      header: 'Throughput',
      width: '128px',
      sortable: false,
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        const stubs = enrichPipeline(pipeline, effectiveStatus)
        const isActive = effectiveStatus === 'active'
        const sparkColor = pipeline.health_status === 'unstable'
          ? 'var(--color-foreground-warning)'
          : 'var(--color-foreground-primary)'
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono caption-1 text-[var(--table-fg)] w-10 text-right tabular-nums shrink-0">
              {isActive ? formatNumber(stubs.throughput) : '0'}
            </span>
            <SparklineMini
              data={stubs.throughputSpark}
              width={52}
              height={16}
              color={isActive ? sparkColor : 'var(--color-foreground-neutral-faded)'}
            />
          </div>
        )
      },
    },

    // ── DLQ ────────────────────────────────────────────────────────────────
    {
      key: 'dlqStats',
      header: 'DLQ',
      width: '72px',
      align: 'right',
      sortable: true,
      sortKey: 'dlq_stats.unconsumed_messages',
      render: (pipeline) => {
        const count = pipeline.dlq_stats?.unconsumed_messages ?? 0
        const color = count >= 100
          ? 'var(--color-foreground-critical)'
          : count >= 1
            ? 'var(--color-foreground-warning)'
            : 'var(--color-foreground-neutral-faded)'
        return (
          <span
            className={`font-mono caption-1 tabular-nums ${count > 0 ? 'font-semibold' : ''}`}
            style={{ color }}
          >
            {formatNumber(count)}
          </span>
        )
      },
    },

    // ── Owner ──────────────────────────────────────────────────────────────
    {
      key: 'owner',
      header: 'Owner',
      width: '128px',
      sortable: false,
      render: (pipeline) => {
        const stubs = enrichPipeline(pipeline, getEffectiveStatus(pipeline))
        return <OwnerCell {...stubs.owner} />
      },
    },

    // ── Tags ───────────────────────────────────────────────────────────────
    {
      key: 'tags',
      header: 'Tags',
      width: '100px',
      sortable: false,
      render: (pipeline) => <TagsCell tags={pipeline.metadata?.tags || []} />,
    },

    // ── Last deploy ────────────────────────────────────────────────────────
    {
      key: 'lastDeploy',
      header: 'Last deploy',
      width: '112px',
      sortable: false,
      render: (pipeline) => {
        const stubs = enrichPipeline(pipeline, getEffectiveStatus(pipeline))
        return (
          <div className="flex flex-col">
            <span className="font-mono caption-1 text-[var(--table-fg)]">{stubs.lastDeployUser}</span>
            <span className="font-mono text-[10px] text-[var(--color-foreground-neutral-faded)]">{stubs.lastDeployTime}</span>
          </div>
        )
      },
    },

    // ── Actions ────────────────────────────────────────────────────────────
    {
      key: 'actions',
      header: '',
      align: 'center',
      width: '44px',
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        return (
          <TableContextMenu
            pipelineStatus={effectiveStatus}
            isLoading={isPipelineLoading(pipeline.pipeline_id)}
            onStop={() => onStop(pipeline)}
            onResume={() => onResume(pipeline)}
            onEdit={() => onEdit(pipeline)}
            onRename={() => onRename(pipeline)}
            onTerminate={() => onTerminate(pipeline)}
            onDelete={() => onDelete(pipeline)}
            onDownload={() => onDownload(pipeline)}
            onManageTags={() => onManageTags(pipeline)}
          />
        )
      },
    },
  ]
}
