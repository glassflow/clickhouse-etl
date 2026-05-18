'use client'

import { useMemo, useState } from 'react'
import styles from './SortableTable.module.css'

export type SortDirection = 'asc' | 'desc'

type Row = Record<string, string | number | null | undefined>

type BaseColumn = {
  key: string
  label: string
  sortable?: boolean
  sortKey?: string
}

type TextColumn = BaseColumn & { type?: 'text' }

type LinkColumn = BaseColumn & {
  type: 'link'
  hrefField: string
  hrefPrefix?: string
}

export type SortableTableColumn = TextColumn | LinkColumn

interface SortableTableProps {
  columns: SortableTableColumn[]
  rows: Row[]
  initialSort?: { key: string; direction: SortDirection }
  /** Optional aria-label for the underlying table element. */
  ariaLabel?: string
}

function cellText(row: Row, key: string): string {
  const value = row[key]
  return value == null ? '' : String(value)
}

function compare(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
}

// Small inline SVG glyphs — keeps us off lucide-react and gives us crisp
// theme-aware indicators. 10x10 viewBox, currentColor for theming.
function SortNeutralIcon() {
  return (
    <svg
      className={styles.sortIcon}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 3.75 5 1.75 7 3.75" />
      <path d="M3 6.25 5 8.25 7 6.25" />
    </svg>
  )
}

function SortAscIcon() {
  return (
    <svg
      className={`${styles.sortIcon} ${styles.sortIconActive}`}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 6 5 3.5 7.5 6" />
    </svg>
  )
}

function SortDescIcon() {
  return (
    <svg
      className={`${styles.sortIcon} ${styles.sortIconActive}`}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 4 5 6.5 7.5 4" />
    </svg>
  )
}

export function SortableTable({ columns, rows, initialSort, ariaLabel }: SortableTableProps) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSort?.key)
  const [sortDir, setSortDir] = useState<SortDirection>(initialSort?.direction ?? 'asc')

  const sortFieldFor = useMemo(() => {
    const map: Record<string, string> = {}
    for (const col of columns) {
      map[col.key] = col.sortKey ?? col.key
    }
    return map
  }, [columns])

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    const field = sortFieldFor[sortKey]
    if (!field) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[field] ?? ''
      const bv = b[field] ?? ''
      const result = compare(
        typeof av === 'number' ? av : String(av),
        typeof bv === 'number' ? bv : String(bv),
      )
      return sortDir === 'asc' ? result : -result
    })
    return copy
  }, [rows, sortKey, sortDir, sortFieldFor])

  function handleHeaderClick(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function renderCell(col: SortableTableColumn, row: Row) {
    const text = cellText(row, col.key)
    if (col.type === 'link') {
      const target = cellText(row, col.hrefField)
      const href = (col.hrefPrefix ?? '') + target
      return (
        <a href={href} className={styles.link}>
          {text}
        </a>
      )
    }
    return text
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table} aria-label={ariaLabel}>
        <thead>
          <tr className={styles.headerRow}>
            {columns.map(col => {
              const isActive = sortKey === col.key
              const ariaSort = !col.sortable
                ? undefined
                : isActive
                  ? sortDir === 'asc' ? 'ascending' : 'descending'
                  : 'none'
              return (
                <th key={col.key} className={styles.headerCell} aria-sort={ariaSort} scope="col">
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleHeaderClick(col.key)}
                      className={
                        isActive
                          ? `${styles.headerButton} ${styles.headerButtonActive}`
                          : styles.headerButton
                      }
                    >
                      <span>{col.label}</span>
                      {isActive ? (
                        sortDir === 'asc' ? <SortAscIcon /> : <SortDescIcon />
                      ) : (
                        <SortNeutralIcon />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr key={i} className={styles.row}>
              {columns.map(col => (
                <td key={col.key} className={styles.cell}>
                  {renderCell(col, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
