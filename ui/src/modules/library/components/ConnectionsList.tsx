'use client'

import Link from 'next/link'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, FolderIcon } from 'lucide-react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { EmptyState } from '@/src/components/ui/empty-state'
import { Skeleton } from '@/src/components/ui/skeleton'
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

type ConnectionsListProps = {
  connections: LibraryConnection[]
  kind: ConnectionKind
  searchQuery: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  emptyLabel?: string
  folders?: LibraryFolder[]
}

// ─── Component ────────────────────────────────────────────────────────────────

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((conn) => (
        <ConnectionCard
          key={conn.id}
          connection={conn}
          kind={kind}
          onEdit={onEdit}
          onDelete={onDelete}
          folders={folders}
        />
      ))}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ConnectionCard({
  connection,
  kind,
  onEdit,
  onDelete,
  folders,
}: {
  connection: LibraryConnection
  kind: ConnectionKind
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  folders: LibraryFolder[]
}) {
  const { id, name, description, tags, folderId, updatedAt } = connection
  const glyphType = kind === 'kafka' ? 'kafka' : 'clickhouse'
  const folderName = folderId ? (folders.find((f) => f.id === folderId)?.name ?? null) : null
  const updated = formatRelativeTime(updatedAt)
  const sourceLabel = kind === 'kafka' ? 'kafka' : 'clickhouse'
  const detailHref = `/library/connections/${kind}/${id}`

  return (
    <Card variant="dark" className="group flex flex-col gap-0 p-0 overflow-hidden hover:border-[var(--color-gray-dark-300)] transition-colors">
      <div className="flex flex-col gap-2.5 p-4 flex-1">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <LibraryTypeGlyph type={glyphType} size="md" />
          <div className="flex-1 min-w-0">
            <Link
              href={detailHref}
              className="title-6 text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)] transition-colors line-clamp-1 block"
            >
              {name}
            </Link>
            <p className="caption-1 text-[var(--text-tertiary)] font-mono mt-0.5">
              {sourceLabel} · {updated}
            </p>
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
        <StatCell label="pipelines">
          <PipelineUsagePlaceholder />
        </StatCell>
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

function PipelineUsagePlaceholder() {
  return (
    <Skeleton width={20} height={11} className="inline-block align-middle" />
  )
}
