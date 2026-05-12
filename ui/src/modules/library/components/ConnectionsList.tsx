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
import type { LibraryFolder } from '@/src/hooks/useLibraryConnections'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LibraryConnection = {
  id: string
  name: string
  description?: string | null
  tags?: string[]
  folderId?: string | null
  createdAt: string
  updatedAt: string
}

export type ConnectionKind = 'kafka' | 'clickhouse'

// ─── Component ────────────────────────────────────────────────────────────────

type ConnectionsListProps = {
  connections: LibraryConnection[]
  kind: ConnectionKind
  searchQuery: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  emptyLabel?: string
  folders?: LibraryFolder[]
}

export function ConnectionsList({
  connections,
  kind,
  searchQuery,
  onEdit,
  onDelete,
  emptyLabel = 'No connections saved yet.',
  folders = [],
}: ConnectionsListProps) {
  const q = searchQuery.trim().toLowerCase()

  const filtered = q
    ? connections.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q) ||
          (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      )
    : connections

  if (filtered.length === 0) {
    return (
      <EmptyState
        heading={q ? 'No matches' : 'No connections yet'}
        copy={q ? `No connections match "${searchQuery}".` : emptyLabel}
      />
    )
  }

  const glyphType = kind === 'kafka' ? 'kafka' : 'clickhouse'

  const columns: DataTableColumn<LibraryConnection>[] = [
    {
      key: 'name',
      header: 'Name',
      width: '2.5fr',
      render: (c) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <LibraryTypeGlyph type={glyphType} size="sm" className="shrink-0" />
          <Link
            href={`/library/connections/${kind}/${c.id}`}
            className="body-3 font-medium text-[var(--color-foreground-neutral)] hover:text-[var(--color-foreground-primary)] transition-colors truncate"
          >
            {c.name}
          </Link>
        </div>
      ),
    },
    {
      key: 'folder',
      header: 'Folder',
      width: '2fr',
      render: (c) => {
        const folderName = c.folderId ? (folders.find((f) => f.id === c.folderId)?.name ?? null) : null
        return <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{folderName ?? '—'}</span>
      },
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '2fr',
      render: (c) => {
        const tags = c.tags ?? []
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
      render: (c) => (
        <span className="caption-1 font-mono text-[var(--color-gray-dark-500)]">{formatRelativeTime(c.updatedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '44px',
      align: 'right',
      render: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
              aria-label={`Actions for ${c.name}`}
            >
              <MoreHorizontalIcon size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(c.id)}>
              <PencilIcon size={13} className="mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--color-foreground-critical)]" onClick={() => onDelete(c.id)}>
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
      getRowId={(c) => c.id}
      ariaLabel={kind === 'kafka' ? 'Kafka connections' : 'ClickHouse connections'}
    />
  )
}
