'use client'

import { PencilIcon, Trash2Icon } from 'lucide-react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LibraryConnection = {
  id: string
  name: string
  description?: string | null
  tags?: string[]
  createdAt: string
}

type ConnectionsListProps = {
  connections: LibraryConnection[]
  searchQuery: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  emptyLabel?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConnectionsList({
  connections,
  searchQuery,
  onEdit,
  onDelete,
  emptyLabel = 'No connections saved yet.',
}: ConnectionsListProps) {
  const q = searchQuery.trim().toLowerCase()

  const filtered = q
    ? connections.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q),
      )
    : connections

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="body-3 text-[var(--text-secondary)]">
          {q ? `No connections match "${searchQuery}".` : emptyLabel}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((conn) => (
        <ConnectionCard
          key={conn.id}
          connection={conn}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// ─── Card sub-component ───────────────────────────────────────────────────────

function ConnectionCard({
  connection,
  onEdit,
  onDelete,
}: {
  connection: LibraryConnection
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { id, name, description, tags } = connection

  return (
    <Card variant="dark" className="flex flex-col gap-3 p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span className="body-2 text-[var(--text-primary)] font-medium leading-tight break-all">
          {name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${name}`}
            onClick={() => onEdit(id)}
          >
            <PencilIcon size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${name}`}
            onClick={() => onDelete(id)}
          >
            <Trash2Icon size={14} />
          </Button>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="caption-1 text-[var(--text-secondary)] line-clamp-2">{description}</p>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  )
}
