'use client'

import Link from 'next/link'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
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
import { type LibraryTransform, type LibraryFolder } from '@/src/hooks/useLibraryConnections'

// ─── Column layout ────────────────────────────────────────────────────────────

const COLS = '2.5fr 0.8fr 2fr 2fr 1fr 44px'
const HEADERS = ['Name', 'Language', 'Folder', 'Tags', 'Updated', '']

// ─── Component ────────────────────────────────────────────────────────────────

type TransformsListProps = {
  transforms: LibraryTransform[]
  searchQuery: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  folders?: LibraryFolder[]
}

export function TransformsList({
  transforms,
  searchQuery,
  onEdit,
  onDelete,
  folders = [],
}: TransformsListProps) {
  const q = searchQuery.trim().toLowerCase()
  const filtered = q
    ? transforms.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q),
      )
    : transforms

  if (filtered.length === 0) {
    return (
      <EmptyState
        heading={q ? 'No matches' : 'No transforms saved yet'}
        copy={
          q
            ? `No transforms match "${searchQuery}".`
            : 'Save reusable JS or SQL transforms to share across pipelines.'
        }
      />
    )
  }

  return (
    <div className="table-container library-table">
      <div className="table-header">
        <div className="table-header-row" style={{ gridTemplateColumns: COLS }}>
          {HEADERS.map((h, i) => (
            <div key={i} className="table-header-cell">{h}</div>
          ))}
        </div>
      </div>
      <div className="table-body">
        {filtered.map((t) => (
          <TransformRow key={t.id} transform={t} onEdit={onEdit} onDelete={onDelete} folders={folders} />
        ))}
      </div>
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TransformRow({
  transform,
  onEdit,
  onDelete,
  folders,
}: {
  transform: LibraryTransform
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  folders: LibraryFolder[]
}) {
  const { id, name, tags, language, folderId, updatedAt } = transform
  const folderName = folderId ? (folders.find((f) => f.id === folderId)?.name ?? null) : null
  const updated = formatRelativeTime(updatedAt)

  return (
    <div className="table-row group" style={{ gridTemplateColumns: COLS }}>
      {/* Name */}
      <div className="table-cell flex items-center gap-2.5 min-w-0">
        <LibraryTypeGlyph type="transform" size="sm" className="shrink-0" />
        <Link
          href={`/library/transforms/${id}`}
          className="body-3 font-medium text-[var(--color-foreground-neutral)] hover:text-[var(--color-foreground-primary)] transition-colors truncate"
        >
          {name}
        </Link>
      </div>

      {/* Language */}
      <div className="table-cell">
        <span className="caption-1 font-mono uppercase tracking-wide text-[var(--color-gray-dark-500)]">
          {language ?? '—'}
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
            {(tags ?? []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
            {(tags ?? []).length > 3 && (
              <span className="caption-1 text-[var(--color-gray-dark-500)]">
                +{(tags ?? []).length - 3}
              </span>
            )}
          </>
        ) : (
          <span className="caption-1 text-[var(--color-gray-dark-700)]">—</span>
        )}
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
