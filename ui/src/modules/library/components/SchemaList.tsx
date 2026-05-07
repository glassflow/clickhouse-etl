'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, FolderIcon } from 'lucide-react'
import { Card } from '@/src/components/ui/card'
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

// ─── Props ────────────────────────────────────────────────────────────────────

type SchemaListProps = {
  schemas: LibrarySchema[]
  searchQuery?: string
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  folders?: LibraryFolder[]
}

const SOURCE_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'kafka', label: 'Kafka' },
  { key: 'otlp', label: 'OTLP' },
  { key: 'manual', label: 'Manual' },
] as const

const USAGE_CHIPS = [
  { key: 'any', label: 'Any usage' },
  { key: 'used', label: 'Used' },
  { key: 'unused', label: 'Unused' },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export function SchemaList({ schemas, searchQuery = '', onEdit = () => {}, onDelete = () => {}, folders = [] }: SchemaListProps) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'kafka' | 'otlp' | 'manual'>('all')
  const [usageFilter, setUsageFilter] = useState<'any' | 'used' | 'unused'>('any')

  const q = searchQuery.trim().toLowerCase()

  const filtered = q
    ? schemas.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q) ||
          s.fields.some((f) => f.name.toLowerCase().includes(q)),
      )
    : schemas

  const sourceFiltered = sourceFilter === 'all'
    ? filtered
    : filtered.filter(s => s.source === sourceFilter)

  const finalFiltered = usageFilter === 'any'
    ? sourceFiltered
    : usageFilter === 'used'
      ? sourceFiltered.filter(s => s.usedByCount > 0)
      : sourceFiltered.filter(s => s.usedByCount === 0)

  if (finalFiltered.length === 0 && filtered.length === 0) {
    return (
      <EmptyState
        heading={q ? 'No matches' : 'No schemas yet'}
        copy={q ? `No schemas match "${searchQuery}".` : 'No schemas saved yet.'}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FilterChips
          chips={SOURCE_CHIPS}
          value={sourceFilter}
          onChange={(v) => setSourceFilter(v as typeof sourceFilter)}
        />
        <div className="w-px h-4 bg-[var(--surface-border)]" />
        <FilterChips
          chips={USAGE_CHIPS}
          value={usageFilter}
          onChange={(v) => setUsageFilter(v as typeof usageFilter)}
        />
      </div>
      {finalFiltered.length === 0 ? (
        <EmptyState
          heading="No matches"
          copy="No schemas match the selected filters."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {finalFiltered.map((schema) => (
            <SchemaCard key={schema.id} schema={schema} onEdit={onEdit} onDelete={onDelete} folders={folders} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function SchemaCard({
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
  const { id, name, description, tags, fields, folderId, updatedAt, source, latestVersion, hasDrift, usedByCount } = schema
  const folderName = folderId ? (folders.find((f) => f.id === folderId)?.name ?? null) : null
  const updated = formatRelativeTime(updatedAt)
  const metaLine = [source, latestVersion, updated].filter(Boolean).join(' · ')

  return (
    <Card variant="dark" className={`group flex flex-col gap-0 p-0 overflow-hidden hover:border-[var(--color-gray-dark-300)] transition-colors ${hasDrift ? 'schema-card-drift' : ''}`}>
      <div className="flex flex-col gap-2.5 p-4 flex-1">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <LibraryTypeGlyph type="schema" size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href={`/library/schemas/${id}`}
                className="title-6 text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)] transition-colors line-clamp-1 block"
              >
                {name}
              </Link>
              {hasDrift && (
                <span className="caption-1 text-[var(--color-yellow-400)] shrink-0">drift</span>
              )}
            </div>
            <p className="caption-1 text-[var(--text-tertiary)] font-mono mt-0.5">{metaLine}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-0.5 -mr-1"
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

        {/* Description */}
        {description && (
          <p className="caption-1 text-[var(--text-secondary)] line-clamp-2">{description}</p>
        )}

        {/* Folder path */}
        {folderName && (
          <div className="flex items-center gap-1.5 caption-1 text-[var(--text-tertiary)]">
            <FolderIcon size={11} className="shrink-0" />
            <span className="truncate">{folderName}</span>
          </div>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--surface-border)]">
        <StatCell label="fields">{fields.length}</StatCell>
        <StatCell label="pipelines">{usedByCount}</StatCell>
      </div>
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 caption-1 text-[var(--text-tertiary)]">
      <span className="text-[var(--text-primary)] font-semibold">{children}</span>
      <span>{label}</span>
    </div>
  )
}

function FilterChips<T extends string>({
  chips,
  value,
  onChange,
}: {
  chips: ReadonlyArray<{ key: T; label: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.key)}
          className={[
            'px-2.5 py-1 rounded-full caption-1 border transition-colors',
            value === c.key
              ? 'bg-[var(--surface-bg)] border-[var(--color-gray-dark-300)] text-[var(--text-primary)]'
              : 'border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ].join(' ')}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
