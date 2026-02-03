'use client'

import React from 'react'
import Image from 'next/image'
import { Badge } from '@/src/components/ui/badge'
import { ListPipelineConfig, PipelineStatus } from '@/src/types/pipeline'
import { TableColumn } from '@/src/modules/pipelines/PipelinesTable'
import { TableContextMenu } from '@/src/modules/pipelines/TableContextMenu'
import {
  getPipelineStatusLabel,
  getPipelineStatusVariant,
} from '@/src/utils/pipeline-status-display'
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
}

function TagsCell({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) {
    return <span className="text-sm text-muted-foreground">No tags</span>
  }

  const visibleTags = tags.slice(0, 3)
  const remaining = tags.length - visibleTags.length

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleTags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className="rounded-full px-2 py-0.5 text-xs font-medium"
        >
          {tag}
        </Badge>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground">+{remaining} more</span>
      )}
    </div>
  )
}

function getStabilityLabel(status: string) {
  return status === 'stable' ? 'Stable' : 'Unstable'
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
  } = config

  return [
    {
      key: 'name',
      header: 'Name',
      width: '2fr',
      sortable: true,
      render: (pipeline) => {
        const isLoading = isPipelineLoading(pipeline.pipeline_id)
        return (
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-1">
                <Image
                  src={Loader}
                  alt="Loading"
                  width={16}
                  height={16}
                  className="animate-spin"
                />
              </div>
            )}
            <span className="font-medium">{pipeline.name}</span>
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
      render: (pipeline) => pipeline.transformation_type || 'None',
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '2fr',
      align: 'left',
      render: (pipeline) => <TagsCell tags={pipeline.metadata?.tags || []} />,
    },
    {
      key: 'health',
      header: 'Health',
      width: '1fr',
      align: 'left',
      sortable: true,
      sortKey: 'health_status',
      render: (pipeline) => {
        const healthStatus = pipeline.health_status || 'stable'
        return (
          <div className="flex flex-row items-center justify-start gap-2 text-content">
            {healthStatus === 'stable' ? (
              <div className="w-3 h-3 rounded-full bg-green-500 items-center" />
            ) : (
              <div className="w-3 h-3 rounded-full bg-red-500 items-center" />
            )}
            {getStabilityLabel(healthStatus)}
          </div>
        )
      },
    },
    {
      key: 'dlqStats',
      header: 'Events in DLQ',
      width: '1fr',
      align: 'left',
      sortable: true,
      sortKey: 'dlq_stats.unconsumed_messages',
      render: (pipeline) => {
        const unconsumedEvents = pipeline.dlq_stats?.unconsumed_messages || 0
        return (
          <div className="flex flex-row items-center justify-start gap-1 text-content">
            {formatNumber(unconsumedEvents)}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '1fr',
      align: 'center',
      sortable: true,
      render: (pipeline) => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        return (
          <div className="flex flex-row items-center justify-center gap-2 text-content w-full">
            <Badge
              className="rounded-xl my-2 mx-4"
              variant={getPipelineStatusVariant(effectiveStatus)}
            >
              {getPipelineStatusLabel(effectiveStatus)}
            </Badge>
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
