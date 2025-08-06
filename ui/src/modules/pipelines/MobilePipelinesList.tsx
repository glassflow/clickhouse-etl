import React from 'react'
import { ListPipelineConfig, getPipelineStatusFromState } from '@/src/types/pipeline'
import { Badge } from '@/src/components/ui/badge'
import { TableContextMenu } from './TableContextMenu'
import { cn } from '@/src/utils/common.client'
import { PIPELINE_STATUS_MAP } from '@/src/config/constants'
import { Pipeline } from '@/src/types/pipeline'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'

interface MobilePipelinesListProps {
  pipelines: ListPipelineConfig[]
  onPause?: (pipeline: ListPipelineConfig) => void
  onResume?: (pipeline: ListPipelineConfig) => void
  onEdit?: (pipeline: ListPipelineConfig) => void
  onRename?: (pipeline: ListPipelineConfig) => void
  onDelete?: (pipeline: ListPipelineConfig) => void
  onRowClick?: (pipeline: ListPipelineConfig) => void
  isPipelineLoading?: (pipelineId: string) => boolean
  getPipelineOperation?: (pipelineId: string) => string | null
}

export function MobilePipelinesList({
  pipelines,
  onPause,
  onResume,
  onEdit,
  onRename,
  onDelete,
  onRowClick,
  isPipelineLoading,
  getPipelineOperation,
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
    <div className="space-y-4">
      {pipelines.map((pipeline) => {
        const isLoading = isPipelineLoading?.(pipeline.pipeline_id) || false
        const operation = getPipelineOperation?.(pipeline.pipeline_id)

        return (
          <div
            key={pipeline.pipeline_id}
            className={cn(
              'bg-background border border-[var(--color-border-neutral)] rounded-lg p-4 shadow-sm',
              onRowClick && 'cursor-pointer hover:bg-muted/50 transition-colors',
            )}
            onClick={() => onRowClick?.(pipeline)}
          >
            {/* Header with name and actions */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isLoading && (
                    <div className="flex items-center gap-1">
                      <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
                      <span className="text-xs text-blue-600">
                        {operation === 'pause' && 'Pausing...'}
                        {operation === 'resume' && 'Resuming...'}
                        {operation === 'delete' && 'Deleting...'}
                        {operation === 'rename' && 'Renaming...'}
                        {operation === 'edit' && 'Pausing...'}
                      </span>
                    </div>
                  )}
                  <h3 className="font-semibold text-foreground truncate">{pipeline.name}</h3>
                </div>
              </div>
              <div className="ml-3 flex-shrink-0">
                <TableContextMenu
                  pipelineStatus={getPipelineStatusFromState(pipeline.state)}
                  isLoading={isLoading}
                  onPause={onPause ? () => onPause(pipeline) : undefined}
                  onResume={onResume ? () => onResume(pipeline) : undefined}
                  onEdit={onEdit ? () => onEdit(pipeline) : undefined}
                  onRename={onRename ? () => onRename(pipeline) : undefined}
                  onDelete={onDelete ? () => onDelete(pipeline) : undefined}
                />
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Transformation</span>
                <span className="text-sm font-medium">{pipeline.transformation_type || 'None'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={getStatusVariant(pipeline.state)}>{pipeline.state}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm">{new Date(pipeline.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
