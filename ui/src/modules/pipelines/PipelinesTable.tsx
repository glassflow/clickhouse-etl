import React from 'react'
import { cn } from '@/src/utils'
import { TableContextMenu } from './TableContextMenu'
import { Pipeline } from '@/src/api/pipeline-api'

export interface TableColumn<T> {
  key: string
  header: string
  width?: string
  render?: (item: T) => React.ReactNode
}

export interface PipelinesTableProps {
  data: Pipeline[]
  columns: TableColumn<Pipeline>[]
  emptyMessage?: string
  className?: string
  onRowClick?: (item: Pipeline) => void
  isLoading?: boolean
  onPause?: (pipeline: Pipeline) => void
  onEdit?: (pipeline: Pipeline) => void
  onRename?: (pipeline: Pipeline) => void
  onDelete?: (pipeline: Pipeline) => void
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
            <div key={column.key} className="table-header-cell">
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
              <div key={column.key} className="table-cell">
                {column.render ? column.render(item) : (item as any)[column.key]}
              </div>
            ))}
            {/* Context Menu Column */}
            {/* <div className="table-cell flex justify-end">
              <TableContextMenu
                onPause={onPause ? () => onPause(item) : undefined}
                onEdit={onEdit ? () => onEdit(item) : undefined}
                onRename={onRename ? () => onRename(item) : undefined}
                onDelete={onDelete ? () => onDelete(item) : undefined}
              />
            </div> */}
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
