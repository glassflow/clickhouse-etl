// library.search renderer — lists matched resources with click-to-go links
// to the matching Library detail page (Phase 1).

'use client'

import Link from 'next/link'
import type { ToolCallBlock } from '@/src/modules/ai/types'
import { Loader2Icon, SearchIcon } from 'lucide-react'
import { Pill } from '@/src/components/ui/pill'

type ResultKind = 'schema' | 'transform' | 'kafka_connection' | 'clickhouse_connection'

type Result = {
  kind: ResultKind
  id: string
  name: string
}

const HREF: Record<ResultKind, (id: string) => string> = {
  schema: (id) => `/library/schemas/${id}`,
  transform: (id) => `/library/transforms/${id}`,
  kafka_connection: (id) => `/library/connections/kafka/${id}`,
  clickhouse_connection: (id) => `/library/connections/clickhouse/${id}`,
}

export function LibrarySearchCard({ block }: { block: ToolCallBlock }) {
  const output = block.output as { results?: Result[] } | undefined
  const query = (block.input.query as string | undefined) ?? ''
  const results = output?.results ?? []

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised)] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SearchIcon size={14} className="text-[var(--color-foreground-primary)]" />
        <span className="body-3 text-[var(--text-primary)]">Library search</span>
        <span className="mono-2 caption-1 text-[var(--text-tertiary)]">
          &ldquo;{query}&rdquo;
        </span>
        {block.status === 'pending' && (
          <Loader2Icon
            size={12}
            className="animate-spin text-[var(--text-tertiary)] ml-auto"
          />
        )}
      </div>
      {block.status === 'success' && (
        <ul className="flex flex-col gap-1">
          {results.map((r) => (
            <li key={`${r.kind}:${r.id}`}>
              <Link
                href={HREF[r.kind](r.id)}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--interactive-hover-bg)]"
              >
                <Pill>{r.kind.replace(/_/g, ' ')}</Pill>
                <span className="body-3 text-[var(--text-primary)]">{r.name}</span>
              </Link>
            </li>
          ))}
          {results.length === 0 && (
            <span className="caption-1 text-[var(--text-tertiary)]">No matches.</span>
          )}
        </ul>
      )}
      {block.status === 'error' && (
        <span className="caption-1 text-[var(--color-foreground-critical)]">
          {block.errorMessage ?? 'Search failed.'}
        </span>
      )}
    </div>
  )
}
