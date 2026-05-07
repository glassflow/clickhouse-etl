'use client'

import React from 'react'
import Image from 'next/image'
import { Badge } from '@/src/components/ui/badge'
import { ListPipelineConfig, PipelineStatus } from '@/src/types/pipeline'
import { TableColumn } from '@/src/modules/pipelines/PipelinesTable'
import { TableContextMenu } from '@/src/modules/pipelines/TableContextMenu'
import { getPipelineStatusLabel } from '@/src/utils/pipeline-status-display'
import { formatNumber, formatCreatedAt } from '@/src/utils/common.client'
import Loader from '@/src/images/loader-small.svg'

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

const STATUS_DOT_CLASS: Record<string, string> = {
  active: 'bg-[var(--color-foreground-positive)]',
  resuming: 'bg-[var(--color-foreground-warning)]',
  pausing: 'bg-[var(--color-foreground-warning)]',
  paused: 'bg-[var(--color-foreground-neutral-faded)]',
  stopping: 'bg-[var(--color-foreground-neutral-faded)]',
  stopped: 'bg-[var(--color-foreground-neutral-faded)]',
  failed: 'bg-[var(--color-foreground-critical)]',
  terminated: 'bg-[var(--color-foreground-neutral-faded)]',
}

type TypeGlyph = { label: string; color: string }

function deriveTypeGlyphs(transformationType: string | undefined): TypeGlyph[] {
  const t = (transformationType || '').toLowerCase()
  const glyphs: TypeGlyph[] = [{ label: 'I', color: 'text-[var(--color-foreground-info)]' }]
  if (t.includes('join')) glyphs.push({ label: 'J', color: 'text-[var(--color-foreground-warning)]' })
  if (t.includes('dedup')) glyphs.push({ label: 'D', color: 'text-[var(--color-purple-300)]' })
  if (t.includes('filter')) glyphs.push({ label: 'F', color: 'text-[var(--color-foreground-positive)]' })
  if (t.includes('transform')) glyphs.push({ label: 'T', color: 'text-[var(--color-foreground-primary)]' })
  return glyphs
}

function TagsCell({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) {
    return <span className="text-sm text-[var(--color-foreground-neutral-faded)]">No tags</span>
  }
  const visibleTags = tags.slice(0, 3)
  const remaining = tags.length - visibleTags.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleTags.map((tag) => (
        <Badge key={tag} variant="outline" className="rounded-full px-2 py-0.5 text-xs font-medium">
          {tag}
        </Badge>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-[var(--color-foreground-neutral-faded)]">+{remaining} more</span>
      )}
    </div>
  )
}

export function getPipelineListColumns(
  config: PipelineListColumnsConfig,
): TableColumn<ListPipelineConfig>[] {
  const {
    isPipelineLoading,
    getPipelineOperation,
    getEffectiveStatus,
    onStop,
    onResume,
    onEdit,
    onRename,
    onTerminate,
    onDelete,
    onDownload,
    onManageTags,
    onToggleSelect,
    isSelected,
  } = config

  return [
    {
      key: 'select',
      header: '',
      width: '36px',
      sortable: false,
      render: (pipeline) => (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect(pipeline.pipeline_id)
          }}
          className="flex items-center justify-center"
        >
          <input
            type="checkbox"
            checked={isSelected(pipeline.pipeline_id)}
            onChange={() => {}}
            className="w-4 h-4 cursor-pointer accent-[var(--color-foreground-primary)]"
          />
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      width: '2fr',
      sortable: true,
      render: (pipeline) => {
        const isLoading = isPipelineLoading(pipeline.pipeline_id)
        const dlqCount = pipeline.dlq_stats?.unconsumed_messages ?? 0
        const showSubLine = pipeline.health_status === 'unstable' && dlqCount > 0
        return (
          <div className="flex items-center gap-2">
            {isLoading && (
              <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
            )}
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{pipeline.name}</span>
              {showSubLine && (
                <span className="text-xs font-mono text-[var(--color-foreground-critical)]">
                  {dlqCount.toLocaleString()} events in DLQ
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'operations',
      header: 'Transformation',
      width: '2fr',
      sortable: true,
      sortKey: 'transformation_type',
      render: (pipeline) => {
        const glyphs = deriveTypeGlyphs(pipeline.transformation_type)
        const label = pipeline.transformation_type || 'None'
        return (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {glyphs.map((g) => (
                <span key={g.label} className={`text-xs font-mono font-bold ${g.color}`}>
                  {g.label}
                </span>
              ))}
            </div>
            <span className="text-sm">{label}</span>
          </div>
        )
      },
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '2fr',
      align: 'left',
      render: (pipeline) => <TagsCell tags={pipeline.metadata?.tags || []} />,
    },
    {
      key: 'dlqStats',
      header: 'Events in DLQ',
      width: '1fr',
      align: 'left',
      sortable: true,
      sortKey: 'dlq_stats.unconsumed_messages',
      render: (pipeline) => {
        const count = pipeline.dlq_stats?.unconsumed_messages ?? 0
        let colorClass = 'text-[var(--color-foreground-neutral-faded)]'
        let weightClass = ''
        if (count >= 100) {
          colorClass = 'text-[var(--color-foreground-critical)]'
          weightClass = 'font-bold'
        } else if (count >= 1) {
          colorClass = 'text-[var(--color-foreground-warning)]'
        }
        return (
          <span className={`${colorClass} ${weightClass}`}>{formatNumber(count)}</span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '1fr',
      align: 'left',
      sortable: true,
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        const dotClass = STATUS_DOT_CLASS[effectiveStatus] ?? 'bg-[var(--color-foreground-neutral-faded)]'
        return (
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`}
              data-status={effectiveStatus}
            />
            <span className="font-mono text-xs">{getPipelineStatusLabel(effectiveStatus)}</span>
          </div>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Created',
      width: '1.5fr',
      align: 'left',
      sortable: true,
      render: (pipeline) => (
        <div className="flex flex-row items-center justify-start text-content">
          {formatCreatedAt(pipeline.created_at)}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '1fr',
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
