'use client'

import Link from 'next/link'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
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
import { type LibraryTransform, type LibraryFolder } from '@/src/hooks/useLibraryConnections'

// ─── Component ────────────────────────────────────────────────────────────────

type TransformsListProps = {
  transforms: LibraryTransform[]
  searchQuery: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  folders?: LibraryFolder[]
}

export function TransformsList({ transforms, searchQuery, onEdit, onDelete, folders = [] }: TransformsListProps) {
  const q = searchQuery.trim().toLowerCase()
  const filtered = q
    ? transforms.filter((t) => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q))
    : transforms

  if (filtered.length === 0) {
    return (
      <EmptyState
        heading={q ? 'No matches' : 'No transforms saved yet'}
        copy={
          q ? `No transforms match "${searchQuery}".` : 'Save reusable JS or SQL transforms to share across pipelines.'
        }
      />
    )
  }

  const columns: DataTableColumn<LibraryTransform>[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2.5fr',
      render: (t) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <LibraryTypeGlyph type="transform" size="sm" className="shrink-0" />
          <Link
            href={`/library/transforms/${t.id}`}
            className="body-3 font-medium text-[var(--color-foreground-neutral)] hover:text-[var(--color-foreground-primary)] transition-colors truncate"
          >
            {t.name}
          </Link>
        </div>
      ),
    },
    {
      key: 'language',
      header: 'Language',
      width: '0.8fr',
      render: (t) => (
        <span className="caption-1 font-mono uppercase tracking-wide text-[var(--color-gray-dark-500)]">
          {t.language ?? '—'}
        </span>
      ),
    },
    {
      key: 'folder',
      header: 'Folder',
      width: '2fr',
      render: (t) => {
        const folderName = t.folderId ? (folders.find((f) => f.id === t.folderId)?.name ?? null) : null
        return <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{folderName ?? '—'}</span>
      },
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '2fr',
      render: (t) => {
        const tags = t.tags ?? []
        if (tags.length === 0) {
          return <span className="caption-1 text-[var(--color-gray-dark-700)]">—</span>
        }
        return (
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && <span className="caption-1 text-[var(--color-gray-dark-500)]">+{tags.length - 3}</span>}
          </div>
        )
      },
    },
    {
      key: 'updated',
      header: 'Updated',
      width: '1fr',
      render: (t) => (
        <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{formatRelativeTime(t.updatedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '44px',
      align: 'right',
      render: (t) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
              aria-label={`Actions for ${t.name}`}
            >
              <MoreHorizontalIcon size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(t.id)}>
              <PencilIcon size={13} className="mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--color-foreground-critical)]" onClick={() => onDelete(t.id)}>
              <Trash2Icon size={13} className="mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <DataTable
      className="library-table"
      data={filtered}
      columns={columns}
      getRowId={(t) => t.id}
      ariaLabel="Transforms"
    />
  )
}
