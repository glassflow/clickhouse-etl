'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, AlertTriangleIcon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
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

// ─── Column layout ────────────────────────────────────────────────────────────

const COLS = '2.5fr 0.8fr 0.8fr 1.5fr 1.5fr 0.6fr 0.7fr 1fr 44px'
const HEADERS = ['Name', 'Source', 'Version', 'Folder', 'Tags', 'Fields', 'Pipelines', 'Updated', '']

// ─── Filter chip sets ─────────────────────────────────────────────────────────

const SOURCE_CHIPS = [
  { key: 'all',    label: 'All sources' },
  { key: 'kafka',  label: 'Kafka' },
  { key: 'otlp',   label: 'OTLP' },
  { key: 'manual', label: 'Manual' },
] as const

const USAGE_CHIPS = [
  { key: 'any',    label: 'Any usage' },
  { key: 'used',   label: 'Used' },
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

  const sourceFiltered =
    sourceFilter === 'all' ? searched : searched.filter((s) => s.source === sourceFilter)

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
        <div className="table-container library-table">
          <div className="table-header">
            <div className="table-header-row" style={{ gridTemplateColumns: COLS }}>
              {HEADERS.map((h, i) => (
                <div key={i} className="table-header-cell">{h}</div>
              ))}
            </div>
          </div>
          <div className="table-body">
            {finalFiltered.map((schema) => (
              <SchemaRow
                key={schema.id}
                schema={schema}
                onEdit={onEdit}
                onDelete={onDelete}
                folders={folders}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function SchemaRow({
  schema,
  onEdit,
  onDelete,
  folders,
}: {
  schema: LibrarySchema
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  folders: LibraryFolder[]
}) {
  const { id, name, tags, folderId, updatedAt, source, latestVersion, hasDrift, usedByCount, fields } = schema
  const folderName = folderId ? (folders.find((f) => f.id === folderId)?.name ?? null) : null
  const updated = formatRelativeTime(updatedAt)

  return (
    <div className="table-row group" style={{ gridTemplateColumns: COLS }}>
      {/* Name */}
      <div className="table-cell flex items-center gap-2.5 min-w-0">
        <LibraryTypeGlyph type="schema" size="sm" className="shrink-0" />
        <div className="flex items-center gap-1.5 min-w-0">
          <Link
            href={`/library/schemas/${id}`}
            className="body-3 font-medium text-[var(--color-foreground-neutral)] hover:text-[var(--color-foreground-primary)] transition-colors truncate"
          >
            {name}
          </Link>
          {hasDrift && (
            <AlertTriangleIcon
              size={12}
              className="shrink-0 text-[var(--color-foreground-warning)]"
              aria-label="Schema drift detected"
            />
          )}
        </div>
      </div>

      {/* Source */}
      <div className="table-cell">
        <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{source ?? '—'}</span>
      </div>

      {/* Version */}
      <div className="table-cell">
        <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">
          {latestVersion ?? '—'}
        </span>
      </div>

      {/* Folder */}
      <div className="table-cell">
        <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">
          {folderName ?? '—'}
        </span>
      </div>

      {/* Tags */}
      <div className="table-cell flex items-center gap-1 min-w-0 flex-wrap">
        {(tags ?? []).length > 0 ? (
          <>
            {(tags ?? []).slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
            {(tags ?? []).length > 2 && (
              <span className="caption-1 text-[var(--color-gray-dark-500)]">
                +{(tags ?? []).length - 2}
              </span>
            )}
          </>
        ) : (
          <span className="caption-1 text-[var(--color-gray-dark-700)]">—</span>
        )}
      </div>

      {/* Fields */}
      <div className="table-cell">
        <span className="caption-1 font-mono tabular-nums text-[var(--color-foreground-neutral)]">
          {fields.length}
        </span>
      </div>

      {/* Pipelines */}
      <div className="table-cell">
        <span className="caption-1 font-mono tabular-nums text-[var(--color-foreground-neutral)]">
          {usedByCount}
        </span>
      </div>

      {/* Updated */}
      <div className="table-cell">
        <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{updated}</span>
      </div>

      {/* Actions */}
      <div className="table-cell flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
              aria-label={`Actions for ${name}`}
            >
              <MoreHorizontalIcon size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(id)}>
              <PencilIcon size={13} className="mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[var(--color-foreground-critical)]"
              onClick={() => onDelete(id)}
            >
              <Trash2Icon size={13} className="mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
