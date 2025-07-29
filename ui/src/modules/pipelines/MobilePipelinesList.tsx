import React from 'react'
import { ListPipelineConfig } from '@/src/types/pipeline'
import { Badge } from '@/src/components/ui/badge'
import { TableContextMenu } from './TableContextMenu'
import { cn } from '@/src/utils/common.client'
import { PIPELINE_STATUS_MAP } from '@/src/config/constants'

interface MobilePipelinesListProps {
  pipelines: ListPipelineConfig[]
  onPause?: (pipeline: ListPipelineConfig) => void
  onEdit?: (pipeline: ListPipelineConfig) => void
  onRename?: (pipeline: ListPipelineConfig) => void
  onDelete?: (pipeline: ListPipelineConfig) => void
  onRowClick?: (pipeline: ListPipelineConfig) => void
}

export function MobilePipelinesList({
  pipelines,
  onPause,
  onEdit,
  onRename,
  onDelete,
  onRowClick,
}: MobilePipelinesListProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case PIPELINE_STATUS_MAP.active:
        return 'success'
      case PIPELINE_STATUS_MAP.paused:
        return 'warning'
      case PIPELINE_STATUS_MAP.deleted:
        return 'secondary'
      case PIPELINE_STATUS_MAP.pausing:
        return 'warning'
      case PIPELINE_STATUS_MAP.deleting:
        return 'secondary'
      case PIPELINE_STATUS_MAP.error:
        return 'error'
      default:
        return 'default'
    }
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">
            No pipelines found. Create your first pipeline to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {pipelines.map((pipeline, index) => (
        <div
          key={pipeline.pipeline_id || index}
          className={cn(
            'bg-background border border-[var(--color-border-neutral)] rounded-lg p-4 shadow-sm',
            onRowClick && 'cursor-pointer hover:bg-muted/50 transition-colors',
          )}
          onClick={() => onRowClick?.(pipeline)}
        >
          {/* Header with name and actions */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{pipeline.name}</h3>
            </div>
            <div className="ml-3 flex-shrink-0">
              <TableContextMenu
                onPause={onPause ? () => onPause(pipeline) : undefined}
                onEdit={onEdit ? () => onEdit(pipeline) : undefined}
                onRename={onRename ? () => onRename(pipeline) : undefined}
                onDelete={onDelete ? () => onDelete(pipeline) : undefined}
              />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3">
            {/* Transformation */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Transformation
              </div>
              <div className="text-sm text-foreground">{pipeline.transformation_type || 'None'}</div>
            </div>

            {/* Status */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Status</div>
              <div>
                <Badge variant={getStatusVariant(pipeline.state)}>{pipeline.state}</Badge>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
