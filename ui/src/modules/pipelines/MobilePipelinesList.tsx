import React from 'react'
import { Pipeline } from '@/src/api/pipeline-api'
import { Badge } from '@/src/components/ui/badge'
import { TableContextMenu } from './TableContextMenu'
import { cn } from '@/src/utils'

interface MobilePipelinesListProps {
  pipelines: Pipeline[]
  onPause?: (pipeline: Pipeline) => void
  onEdit?: (pipeline: Pipeline) => void
  onRename?: (pipeline: Pipeline) => void
  onDelete?: (pipeline: Pipeline) => void
  onRowClick?: (pipeline: Pipeline) => void
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
      case 'active':
        return 'success'
      case 'paused':
        return 'warning'
      case 'terminated':
        return 'error'
      case 'deleted':
        return 'secondary'
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
          key={pipeline.id || index}
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
              <div className="text-sm text-foreground">{pipeline.config?.operations?.join(', ') || 'None'}</div>
            </div>

            {/* Status */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Status</div>
              <div>
                <Badge variant={getStatusVariant(pipeline.status)}>{pipeline.status}</Badge>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
