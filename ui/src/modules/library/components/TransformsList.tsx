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
import { type LibraryTransform, type LibraryFolder } from '@/src/hooks/useLibraryConnections'

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((t) => (
        <TransformCard key={t.id} transform={t} onEdit={onEdit} onDelete={onDelete} folders={folders} />
      ))}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function TransformCard({
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
  const { id, name, description, tags, language, folderId, updatedAt } = transform
  const folderName = folderId ? (folders.find((f) => f.id === folderId)?.name ?? null) : null
  const updated = formatRelativeTime(updatedAt)

  return (
    <Card variant="dark" className="group flex flex-col gap-0 p-0 overflow-hidden hover:border-[var(--color-gray-dark-300)] transition-colors">
      <div className="flex flex-col gap-2.5 p-4 flex-1">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <LibraryTypeGlyph type="transform" size="md" />
          <div className="flex-1 min-w-0">
            <Link
              href={`/library/transforms/${id}`}
              className="title-6 text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)] transition-colors line-clamp-1 block"
            >
              {name}
            </Link>
            <p className="caption-1 text-[var(--text-tertiary)] font-mono mt-0.5">
              transform · {updated}
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

        {/* Language badge + tags */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="font-mono caption-2 uppercase">
            {language}
          </Badge>
          {tags &&
            tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
        </div>
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
  return <Skeleton width={20} height={11} className="inline-block align-middle" />
}
