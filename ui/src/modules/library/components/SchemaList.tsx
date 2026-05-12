'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, AlertTriangleIcon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { DataTable, type DataTableColumn } from '@/src/components/ui/data-table'
import { EmptyState } from '@/src/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { LibraryTypeGlyph } from './LibraryTypeGlyph'
import { formatRelativeTime } from '@/src/utils/common.client'
import type { LibrarySchema, LibraryFolder } from '@/src/hooks/useLibraryConnections'

// ─── Filter chip sets ─────────────────────────────────────────────────────────

const SOURCE_CHIPS = [
  { key: 'all', label: 'All sources' },
  { key: 'kafka', label: 'Kafka' },
  { key: 'otlp', label: 'OTLP' },
  { key: 'manual', label: 'Manual' },
] as const

const USAGE_CHIPS = [
  { key: 'any', label: 'Any usage' },
  { key: 'used', label: 'Used' },
  { key: 'unused', label: 'Unused' },
] as const

// ─── Props ────────────────────────────────────────────────────────────────────

type SchemaListProps = {
  schemas: LibrarySchema[]
  searchQuery?: string
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  folders?: LibraryFolder[]
  showFilters?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SchemaList({
  schemas,
  searchQuery = '',
  onEdit = () => {},
  onDelete = () => {},
  folders = [],
  showFilters = true,
}: SchemaListProps) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'kafka' | 'otlp' | 'manual'>('all')
  const [usageFilter, setUsageFilter] = useState<'any' | 'used' | 'unused'>('any')

  const q = searchQuery.trim().toLowerCase()

  const searched = q
    ? schemas.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q) ||
          s.fields.some((f) => f.name.toLowerCase().includes(q)),
      )
    : schemas

  const sourceFiltered = sourceFilter === 'all' ? searched : searched.filter((s) => s.source === sourceFilter)

  const finalFiltered =
    usageFilter === 'any'
      ? sourceFiltered
      : usageFilter === 'used'
        ? sourceFiltered.filter((s) => s.usedByCount > 0)
        : sourceFiltered.filter((s) => s.usedByCount === 0)

  if (searched.length === 0) {
    return (
      <EmptyState
        heading={q ? 'No matches' : 'No schemas yet'}
        copy={q ? `No schemas match "${searchQuery}".` : 'No schemas saved yet.'}
      />
    )
  }

  const columns: DataTableColumn<LibrarySchema>[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2.5fr',
      render: (s) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <LibraryTypeGlyph type="schema" size="sm" className="shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={`/library/schemas/${s.id}`}
              className="body-3 font-medium text-[var(--color-foreground-neutral)] hover:text-[var(--color-foreground-primary)] transition-colors truncate"
            >
              {s.name}
            </Link>
            {s.hasDrift && (
              <AlertTriangleIcon
                size={12}
                className="shrink-0 text-[var(--color-foreground-warning)] schema-card-drift"
                aria-label="Schema drift detected"
              />
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      width: '0.8fr',
      render: (s) => <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{s.source ?? '—'}</span>,
    },
    {
      key: 'version',
      header: 'Version',
      width: '0.8fr',
      render: (s) => (
        <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{s.latestVersion ?? '—'}</span>
      ),
    },
    {
      key: 'folder',
      header: 'Folder',
      width: '1.5fr',
      render: (s) => {
        const folderName = s.folderId ? (folders.find((f) => f.id === s.folderId)?.name ?? null) : null
        return <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{folderName ?? '—'}</span>
      },
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '1.5fr',
      render: (s) => {
        const tags = s.tags ?? []
        if (tags.length === 0) {
          return <span className="caption-1 text-[var(--color-gray-dark-700)]">—</span>
        }
        return (
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            {tags.length > 2 && <span className="caption-1 text-[var(--color-gray-dark-500)]">+{tags.length - 2}</span>}
          </div>
        )
      },
    },
    {
      key: 'fields',
      header: 'Fields',
      width: '0.6fr',
      render: (s) => (
        <span className="caption-1 font-mono tabular-nums text-[var(--color-foreground-neutral)]">
          {s.fields.length}
        </span>
      ),
    },
    {
      key: 'pipelines',
      header: 'Pipelines',
      width: '0.7fr',
      render: (s) => (
        <span className="caption-1 font-mono tabular-nums text-[var(--color-foreground-neutral)]">{s.usedByCount}</span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      width: '1fr',
      render: (s) => (
        <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{formatRelativeTime(s.updatedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '44px',
      align: 'right',
      render: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
              aria-label={`Actions for ${s.name}`}
            >
              <MoreHorizontalIcon size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(s.id)}>
              <PencilIcon size={13} className="mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--color-foreground-critical)]" onClick={() => onDelete(s.id)}>
              <Trash2Icon size={13} className="mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Source + usage filter chips */}
      {showFilters && (
        <div className="lib-filter-bar">
          <div className="flex items-center gap-1.5">
            {SOURCE_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSourceFilter(c.key as typeof sourceFilter)}
                className={`lib-filter-chip${sourceFilter === c.key ? ' is-active' : ''}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-[var(--color-gray-dark-700)]" />
          <div className="flex items-center gap-1.5">
            {USAGE_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setUsageFilter(c.key as typeof usageFilter)}
                className={`lib-filter-chip${usageFilter === c.key ? ' is-active' : ''}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {finalFiltered.length === 0 ? (
        <EmptyState heading="No matches" copy="No schemas match the selected filters." />
      ) : (
        <DataTable
          className="library-table"
          data={finalFiltered}
          columns={columns}
          getRowId={(s) => s.id}
          ariaLabel="Schemas"
        />
      )}
    </div>
  )
}
