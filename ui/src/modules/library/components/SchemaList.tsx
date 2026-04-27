'use client'

import { PencilIcon, Trash2Icon } from 'lucide-react'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import type { LibrarySchema } from '@/src/hooks/useLibraryConnections'

// ─── Props ────────────────────────────────────────────────────────────────────

type SchemaListProps = {
  schemas: LibrarySchema[]
  searchQuery: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SchemaList({ schemas, searchQuery, onEdit, onDelete }: SchemaListProps) {
  const q = searchQuery.trim().toLowerCase()

  const filtered = q
    ? schemas.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q),
      )
    : schemas

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="body-3 text-[var(--text-secondary)]">
          {q ? `No schemas match "${searchQuery}".` : 'No schemas saved yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((schema) => (
        <SchemaCard key={schema.id} schema={schema} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}

// ─── Card sub-component ───────────────────────────────────────────────────────

const PREVIEW_FIELD_COUNT = 4

function SchemaCard({
  schema,
  onEdit,
  onDelete,
}: {
  schema: LibrarySchema
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { id, name, description, tags, fields } = schema
  const previewFields = fields.slice(0, PREVIEW_FIELD_COUNT)
  const remaining = fields.length - previewFields.length

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

      {/* Field previews */}
      {previewFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {previewFields.map((field) => (
            <Badge key={field.name} variant="outline" className="font-mono text-xs">
              {field.name}:&nbsp;{field.type}
            </Badge>
          ))}
          {remaining > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{remaining} more
            </Badge>
          )}
        </div>
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
