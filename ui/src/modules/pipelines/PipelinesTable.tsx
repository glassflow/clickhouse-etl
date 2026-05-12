import React from 'react'
import { cn } from '@/src/utils/common.client'
import { ListPipelineConfig } from '@/src/types/pipeline'
import { DataTable, type DataTableColumn, type SortDirection } from '@/src/components/ui/data-table'

export type { SortDirection }

// Triage-first priority: failures surface at the top when sorted ascending.
// Exported so column definitions can use it as a sortComparator on the status column.
const STATUS_PRIORITY: Record<string, number> = {
  failed: 1,
  pausing: 2,
  resuming: 3,
  active: 4,
  stopping: 5,
  paused: 6,
  stopped: 7,
  terminated: 8,
  terminating: 9,
}

export function statusPriorityComparator(
  a: ListPipelineConfig,
  b: ListPipelineConfig,
  direction: 'asc' | 'desc',
): number {
  const aP = STATUS_PRIORITY[String(a.status ?? '').toLowerCase()] || 999
  const bP = STATUS_PRIORITY[String(b.status ?? '').toLowerCase()] || 999
  return direction === 'asc' ? aP - bP : bP - aP
}

// Legacy column type kept for backwards-compatibility with existing column
// definitions and tests. New code should use DataTableColumn directly.
export type TableColumn<T> = DataTableColumn<T>

export interface PipelinesTableProps {
  data: ListPipelineConfig[]
  columns: TableColumn<ListPipelineConfig>[]
  emptyMessage?: string
  className?: string
  stickyHeader?: boolean
  initialSortColumn?: string | null
  initialSortDirection?: SortDirection
  onRowClick?: (item: ListPipelineConfig) => void
  isLoading?: boolean
  rowClassName?: (item: ListPipelineConfig) => string
}

/**
 * Pipelines list table — thin wrapper around <DataTable> that supplies the
 * pipeline-specific status-priority sort (legacy contract: tests check that
 * sorting "status" produces active → paused → stopped, not alphabetical).
 *
 * Any column whose key/sortKey is "status" and that does not already define
 * its own sortComparator gets the priority comparator wired in automatically.
 */
export function PipelinesTable({
  data,
  columns,
  emptyMessage = 'No data found',
  className,
  stickyHeader = false,
  initialSortColumn = null,
  initialSortDirection = null,
  onRowClick,
  isLoading = false,
  rowClassName,
}: PipelinesTableProps) {
  // Inject the status-priority comparator on the status column if missing.
  const enrichedColumns = React.useMemo(() => {
    return columns.map((col) => {
      const key = col.sortKey ?? col.key
      if (key === 'status' && col.sortable && !col.sortComparator) {
        return { ...col, sortComparator: statusPriorityComparator }
      }
      return col
    })
  }, [columns])

  // Preserve the legacy "Loading..." string display rather than skeleton rows —
  // matches the existing test contract and the visual was working fine.
  if (isLoading) {
    const gridTemplateColumns = columns.map((col) => col.width || '1fr').join(' ')
    return (
      <div className={cn('table-container', className)}>
        <div className={cn('table-header', stickyHeader && 'sticky')}>
          <div className="table-header-row" style={{ gridTemplateColumns }}>
            {columns.map((column) => (
              <div key={column.key} className={cn('table-header-cell', column.align && `text-${column.align}`)}>
                <div
                  className={cn(
                    'flex items-center',
                    column.align === 'center' && 'justify-center',
                    column.align === 'right' && 'justify-end',
                    (!column.align || column.align === 'left') && 'justify-start',
                  )}
                >
                  {column.header}
                </div>
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
    <DataTable
      className={className}
      data={data}
      columns={enrichedColumns}
      getRowId={(p) => p.pipeline_id}
      stickyHeader={stickyHeader}
      onRowClick={onRowClick}
      rowClassName={rowClassName}
      initialSortColumn={initialSortColumn}
      initialSortDirection={initialSortDirection}
      emptyMessage={emptyMessage}
      ariaLabel="Pipelines"
    />
  )
}
