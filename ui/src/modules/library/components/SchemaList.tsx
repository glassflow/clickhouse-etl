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
import type { LibrarySchema, LibraryFolder } from '@/src/hooks/useLibraryConnections'

// ─── Props ────────────────────────────────────────────────────────────────────

type SchemaListProps = {
  schemas: LibrarySchema[]
  searchQuery: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  folders?: LibraryFolder[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SchemaList({ schemas, searchQuery, onEdit, onDelete, folders = [] }: SchemaListProps) {
  const q = searchQuery.trim().toLowerCase()

  const filtered = q
    ? schemas.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q) ||
          s.fields.some((f) => f.name.toLowerCase().includes(q)),
      )
    : schemas

  if (filtered.length === 0) {
    return (
      <EmptyState
        heading={q ? 'No matches' : 'No schemas yet'}
        copy={q ? `No schemas match "${searchQuery}".` : 'No schemas saved yet.'}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((schema) => (
        <SchemaCard key={schema.id} schema={schema} onEdit={onEdit} onDelete={onDelete} folders={folders} />
      ))}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

const PREVIEW_FIELD_COUNT = 3

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
  const { id, name, description, tags, fields, folderId, updatedAt } = schema
  const folderName = folderId ? (folders.find((f) => f.id === folderId)?.name ?? null) : null
  const updated = formatRelativeTime(updatedAt)
  const previewFields = fields.slice(0, PREVIEW_FIELD_COUNT)
  const remaining = fields.length - previewFields.length

  return (
    <Card variant="dark" className="group flex flex-col gap-0 p-0 overflow-hidden hover:border-[var(--color-gray-dark-300)] transition-colors">
      <div className="flex flex-col gap-2.5 p-4 flex-1">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <LibraryTypeGlyph type="schema" size="md" />
          <div className="flex-1 min-w-0">
            <Link
              href={`/library/schemas/${id}`}
              className="title-6 text-[var(--text-primary)] hover:text-[var(--color-foreground-primary)] transition-colors line-clamp-1 block"
            >
              {name}
            </Link>
            <p className="caption-1 text-[var(--text-tertiary)] font-mono mt-0.5">
              schema · {updated}
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

        {/* Field preview pills */}
        {previewFields.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {previewFields.map((field) => (
              <Badge key={field.name} variant="outline" className="font-mono caption-2">
                {field.name}
                <span className="text-[var(--text-tertiary)]">:{field.type}</span>
              </Badge>
            ))}
            {remaining > 0 && (
              <Badge variant="secondary" className="caption-2">
                +{remaining}
              </Badge>
            )}
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
        <StatCell label="fields">
          <strong>{fields.length}</strong>
        </StatCell>
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
