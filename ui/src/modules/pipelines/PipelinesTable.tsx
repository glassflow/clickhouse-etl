import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import { cn } from '@/src/utils/common.client'
import { TableContextMenu } from './TableContextMenu'
import { ListPipelineConfig } from '@/src/types/pipeline'
import SortIcon from '@/src/images/sort.svg'
import SortAscIcon from '@/src/images/sort-up.svg'
import SortDescIcon from '@/src/images/sort-down.svg'

export type SortDirection = 'asc' | 'desc' | null

// Status priority order for semantic sorting
const STATUS_PRIORITY: Record<string, number> = {
  active: 1,
  resuming: 2,
  pausing: 3,
  paused: 4,
  stopping: 5,
  stopped: 6,
  failed: 7,
}

export interface TableColumn<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  sortKey?: string // Key to use for sorting, defaults to 'key' if not provided
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
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Handle column header click for sorting
  const handleSort = (column: TableColumn<ListPipelineConfig>) => {
    if (!column.sortable) return

    const columnKey = column.sortKey || column.key

    if (sortColumn === columnKey) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortColumn(null)
      }
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  // Sort data based on current sort state
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return data
    }

    return [...data].sort((a, b) => {
      let aValue: any
      let bValue: any

      // Handle nested properties (e.g., 'dlq_stats.unconsumed_messages')
      if (sortColumn.includes('.')) {
        const keys = sortColumn.split('.')
        aValue = keys.reduce((obj, key) => obj?.[key], a as any)
        bValue = keys.reduce((obj, key) => obj?.[key], b as any)
      } else {
        aValue = (a as any)[sortColumn]
        bValue = (b as any)[sortColumn]
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1

      // Custom sorting for status column
      if (sortColumn === 'status') {
        const aPriority = STATUS_PRIORITY[String(aValue).toLowerCase()] || 999
        const bPriority = STATUS_PRIORITY[String(bValue).toLowerCase()] || 999
        return sortDirection === 'asc' ? aPriority - bPriority : bPriority - aPriority
      }

      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
        return sortDirection === 'asc' ? comparison : -comparison
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      // For dates
      if (sortColumn === 'created_at') {
        const aDate = new Date(aValue).getTime()
        const bDate = new Date(bValue).getTime()
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate
      }

      // Default string comparison
      const aStr = String(aValue)
      const bStr = String(bValue)
      const comparison = aStr.toLowerCase().localeCompare(bStr.toLowerCase())
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortColumn, sortDirection])

  // Render sort icon for column
  const renderSortIcon = (column: TableColumn<ListPipelineConfig>) => {
    if (!column.sortable) return null

    const columnKey = column.sortKey || column.key
    const isActive = sortColumn === columnKey

    if (!isActive) {
      return <Image src={SortIcon} alt="Sort" width={14} height={14} className="ml-1 text-gray-400" />
    }

    if (sortDirection === 'asc') {
      return <Image src={SortAscIcon} alt="Sort Ascending" width={14} height={14} className="ml-1" />
    }

    return <Image src={SortDescIcon} alt="Sort Descending" width={14} height={14} className="ml-1" />
  }

  if (isLoading) {
    return (
      <div className={cn('table-container', className)}>
        <div className="table-header">
          <div className="table-header-row" style={{ gridTemplateColumns }}>
            {columns.map((column) => (
              <div
                key={column.key}
                className={cn(
                  'table-header-cell',
                  column.align && `text-${column.align}`,
                  column.sortable && 'cursor-pointer select-none',
                )}
              >
                <div
                  className={cn(
                    'flex items-center',
                    column.align === 'center' && 'justify-center',
                    column.align === 'right' && 'justify-end',
                    (!column.align || column.align === 'left') && 'justify-start',
                  )}
                >
                  {column.header}
                  {renderSortIcon(column)}
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
    <div className={cn('table-container', className)}>
      {/* Table Header */}
      <div className="table-header">
        <div className="table-header-row" style={{ gridTemplateColumns }}>
          {columns.map((column) => (
            <div
              key={column.key}
              className={cn(
                'table-header-cell',
                column.align && `text-${column.align}`,
                column.sortable && 'cursor-pointer select-none hover:opacity-70',
              )}
              onClick={() => handleSort(column)}
            >
              <div
                className={cn(
                  'flex items-center',
                  column.align === 'center' && 'justify-center',
                  column.align === 'right' && 'justify-end',
                  (!column.align || column.align === 'left') && 'justify-start',
                )}
              >
                {column.header}
                {renderSortIcon(column)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Body */}
      <div className="table-body">
        {sortedData.map((item, index) => (
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
        {sortedData.length === 0 && (
          <div className="table-row" style={{ gridTemplateColumns }}>
            <div className="table-cell-empty">{emptyMessage}</div>
          </div>
        )}
      </div>
    </div>
  )
}
