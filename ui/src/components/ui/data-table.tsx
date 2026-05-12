'use client'

import * as React from 'react'
import Image from 'next/image'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/src/utils/common.client'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import SortIcon from '@/src/images/sort.svg'
import SortAscIcon from '@/src/images/sort-up.svg'
import SortDescIcon from '@/src/images/sort-down.svg'

export type SortDirection = 'asc' | 'desc' | null
export type RowStatus = 'critical' | 'warning'

export interface DataTableColumn<T> {
  key: string
  header: React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  sortKey?: string
  className?: string
  headerClassName?: string
}

const dataTableVariants = cva('table-container data-table', {
  variants: {
    density: {
      comfortable: 'data-table-comfortable',
      compact: 'data-table-compact',
    },
  },
  defaultVariants: {
    density: 'comfortable',
  },
})

export interface DataTableProps<T> extends VariantProps<typeof dataTableVariants> {
  data: T[]
  columns: DataTableColumn<T>[]
  getRowId: (item: T) => string
  stickyHeader?: boolean
  onRowClick?: (item: T) => void
  isLoading?: boolean
  loadingRowCount?: number
  empty?: React.ReactNode
  emptyMessage?: string
  rowStatus?: (item: T) => RowStatus | undefined
  rowClassName?: (item: T) => string
  initialSortColumn?: string | null
  initialSortDirection?: SortDirection
  onSortChange?: (column: string | null, direction: SortDirection) => void
  className?: string
  ariaLabel?: string
}

function resolveSortValue(item: unknown, path: string): unknown {
  if (!path.includes('.')) return (item as Record<string, unknown>)[path]
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, item)
}

function compare(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  if (a == null && b == null) return 0
  if (a == null) return direction === 'asc' ? 1 : -1
  if (b == null) return direction === 'asc' ? -1 : 1
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a
  }
  const aStr = String(a).toLowerCase()
  const bStr = String(b).toLowerCase()
  const cmp = aStr.localeCompare(bStr)
  return direction === 'asc' ? cmp : -cmp
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  density,
  stickyHeader = false,
  onRowClick,
  isLoading = false,
  loadingRowCount = 5,
  empty,
  emptyMessage = 'No items found',
  rowStatus,
  rowClassName,
  initialSortColumn = null,
  initialSortDirection = null,
  onSortChange,
  className,
  ariaLabel,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(initialSortColumn)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(initialSortDirection)

  const gridTemplateColumns = React.useMemo(
    () => columns.map((col) => col.width ?? '1fr').join(' '),
    [columns],
  )

  const updateSort = (next: { column: string | null; direction: SortDirection }) => {
    setSortColumn(next.column)
    setSortDirection(next.direction)
    onSortChange?.(next.column, next.direction)
  }

  const handleHeaderClick = (column: DataTableColumn<T>) => {
    if (!column.sortable) return
    const key = column.sortKey ?? column.key
    if (sortColumn !== key) {
      updateSort({ column: key, direction: 'asc' })
      return
    }
    // cycle: asc → desc → off
    if (sortDirection === 'asc') updateSort({ column: key, direction: 'desc' })
    else updateSort({ column: null, direction: null })
  }

  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return data
    return [...data].sort((a, b) =>
      compare(resolveSortValue(a, sortColumn), resolveSortValue(b, sortColumn), sortDirection),
    )
  }, [data, sortColumn, sortDirection])

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, item: T) => {
    if (!onRowClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick(item)
    }
  }

  const renderSortIcon = (column: DataTableColumn<T>) => {
    if (!column.sortable) return null
    const key = column.sortKey ?? column.key
    const isActive = sortColumn === key
    if (!isActive) return <Image src={SortIcon} alt="" width={12} height={12} className="ml-1 opacity-60" aria-hidden="true" />
    if (sortDirection === 'asc') return <Image src={SortAscIcon} alt="" width={12} height={12} className="ml-1" aria-hidden="true" />
    return <Image src={SortDescIcon} alt="" width={12} height={12} className="ml-1" aria-hidden="true" />
  }

  const ariaSortFor = (column: DataTableColumn<T>): 'ascending' | 'descending' | 'none' | undefined => {
    if (!column.sortable) return undefined
    const key = column.sortKey ?? column.key
    if (sortColumn !== key || !sortDirection) return 'none'
    return sortDirection === 'asc' ? 'ascending' : 'descending'
  }

  const showEmpty = !isLoading && sortedData.length === 0

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      className={cn(dataTableVariants({ density }), className)}
    >
      <div className={cn('table-header', stickyHeader && 'sticky')} role="rowgroup">
        <div className="table-header-row" role="row" style={{ gridTemplateColumns }}>
          {columns.map((column) => (
            <div
              key={column.key}
              role="columnheader"
              aria-sort={ariaSortFor(column)}
              className={cn(
                'table-header-cell',
                column.align && `text-${column.align}`,
                column.sortable && 'sortable',
                column.headerClassName,
              )}
              onClick={column.sortable ? () => handleHeaderClick(column) : undefined}
              onKeyDown={(e) => {
                if (!column.sortable) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleHeaderClick(column)
                }
              }}
              tabIndex={column.sortable ? 0 : undefined}
            >
              <span
                className={cn(
                  'inline-flex items-center',
                  column.align === 'center' && 'justify-center w-full',
                  column.align === 'right' && 'justify-end w-full',
                )}
              >
                {column.header}
                {renderSortIcon(column)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="table-body" role="rowgroup">
        {isLoading
          ? Array.from({ length: loadingRowCount }).map((_, i) => (
              <div
                key={`__skeleton-${i}`}
                className="table-row"
                role="row"
                style={{ gridTemplateColumns }}
                aria-hidden="true"
              >
                {columns.map((column, ci) => (
                  <div key={column.key} className={cn('table-cell', column.align && `text-${column.align}`)} role="gridcell">
                    <Skeleton height={14} className={ci === 0 ? 'w-3/4' : 'w-1/2'} />
                  </div>
                ))}
              </div>
            ))
          : sortedData.map((item) => {
              const status = rowStatus?.(item)
              const clickable = Boolean(onRowClick)
              return (
                <div
                  key={getRowId(item)}
                  role="row"
                  data-status={status || undefined}
                  data-clickable={clickable || undefined}
                  className={cn('table-row group', clickable && 'cursor-pointer', rowClassName?.(item))}
                  style={{ gridTemplateColumns }}
                  onClick={clickable ? () => onRowClick!(item) : undefined}
                  onKeyDown={clickable ? (e) => handleRowKeyDown(e, item) : undefined}
                  tabIndex={clickable ? 0 : undefined}
                >
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      role="gridcell"
                      data-label={typeof column.header === 'string' ? column.header : undefined}
                      className={cn('table-cell', column.align && `text-${column.align}`, column.className)}
                    >
                      {column.render ? column.render(item) : ((item as Record<string, unknown>)[column.key] as React.ReactNode)}
                    </div>
                  ))}
                </div>
              )
            })}

        {showEmpty && (
          <div className="table-row" role="row" style={{ gridTemplateColumns: '1fr' }}>
            <div className="table-cell-empty" role="gridcell">
              {empty ?? <EmptyState heading="Nothing to show" copy={emptyMessage} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { dataTableVariants }
