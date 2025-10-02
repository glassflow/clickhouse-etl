import React from 'react'
import { cn } from '@/src/utils/common.client'
import { TableContextMenu } from './TableContextMenu'
import { ListPipelineConfig } from '@/src/types/pipeline'

export interface TableColumn<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (item: T) => React.ReactNode
}

export interface PipelinesTableProps {
  data: ListPipelineConfig[]
  columns: TableColumn<ListPipelineConfig>[]
  emptyMessage?: string
  className?: string
  onRowClick?: (item: ListPipelineConfig) => void
  isLoading?: boolean
  onPause?: (pipeline: ListPipelineConfig) => void
  onEdit?: (pipeline: ListPipelineConfig) => void
  onRename?: (pipeline: ListPipelineConfig) => void
  onDelete?: (pipeline: ListPipelineConfig) => void
}

export function PipelinesTable({
  data,
  columns,
  emptyMessage = 'No data found',
  className,
  onRowClick,
  isLoading = false,
  onPause,
  onEdit,
  onRename,
  onDelete,
}: PipelinesTableProps) {
  const gridTemplateColumns = columns.map((col) => col.width || '1fr').join(' ')

  if (isLoading) {
    return (
      <div className={cn('table-container', className)}>
        <div className="table-header">
          <div className="table-header-row" style={{ gridTemplateColumns }}>
            {columns.map((column) => (
              <div key={column.key} className="table-header-cell">
                {column.header}
              </div>
            ))}
          </div>
        </div>
        <div className="table-body">
          <div className="table-cell-empty">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('table-container', className)}>
      {/* Table Header */}
      <div className="table-header">
        <div className="table-header-row" style={{ gridTemplateColumns }}>
          {columns.map((column) => (
            <div key={column.key} className={cn('table-header-cell', column.align && `text-${column.align}`)}>
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Table Body */}
      <div className="table-body">
        {data.map((item, index) => (
          <div
            key={index}
            className={cn('table-row', onRowClick && 'cursor-pointer')}
            onClick={() => onRowClick?.(item)}
            style={{ gridTemplateColumns }}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className={cn('table-cell', column.align && `text-${column.align}`)}
                data-label={column.header}
              >
                {column.render ? column.render(item) : (item as any)[column.key]}
              </div>
            ))}
          </div>
        ))}
        {data.length === 0 && (
          <div className="table-row" style={{ gridTemplateColumns }}>
            <div className="table-cell-empty">{emptyMessage}</div>
          </div>
        )}
      </div>
    </div>
  )
}
