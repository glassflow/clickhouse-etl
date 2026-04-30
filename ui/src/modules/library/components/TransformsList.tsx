'use client'

import Link from 'next/link'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { EmptyState } from '@/src/components/ui/empty-state'
import { type LibraryTransform } from '@/src/hooks/useLibraryConnections'

type TransformsListProps = {
  transforms: LibraryTransform[]
  searchQuery: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function TransformsList({
  transforms,
  searchQuery,
  onEdit,
  onDelete,
}: TransformsListProps) {
  const q = searchQuery.trim().toLowerCase()
  const filtered = q
    ? transforms.filter((t) => t.name.toLowerCase().includes(q))
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
    <ul className="flex flex-col divide-y divide-[var(--surface-border)] rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)]">
      {filtered.map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <Link
            href={`/library/transforms/${t.id}`}
            className="flex items-center gap-3 flex-1 min-w-0 hover:text-[var(--color-foreground-primary)] transition-colors"
          >
            <span className="body-3 text-[var(--text-primary)] truncate">{t.name}</span>
            <Badge variant="outline">{t.language}</Badge>
            {t.description && (
              <span className="caption-1 text-[var(--text-tertiary)] truncate">
                {t.description}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${t.name}`}
              onClick={() => onEdit(t.id)}
            >
              <PencilIcon size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${t.name}`}
              onClick={() => onDelete(t.id)}
            >
              <Trash2Icon size={14} />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
