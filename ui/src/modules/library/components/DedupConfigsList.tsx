import Link from 'next/link'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'

type Props = { configs: LibraryDedupConfig[] }

export function DedupConfigsList({ configs }: Props) {
  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="body-3 text-[var(--text-secondary)]">No dedup configs yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {configs.map(cfg => (
        <Link key={cfg.id} href={`/library/dedup/${cfg.id}`} className="block">
          <Card
            variant="dark"
            className={`p-4 h-full hover:border-[var(--surface-border-hover)] transition-colors ${cfg.hasDrift ? 'schema-card-drift' : ''}`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="title-6 text-[var(--text-primary)] truncate">{cfg.name}</span>
              <Badge variant="secondary">{cfg.latestVersion}</Badge>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline">{cfg.windowType}</Badge>
              <Badge variant="outline">{cfg.windowDuration}</Badge>
              {cfg.hasDrift && <Badge variant="warning">drift</Badge>}
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {cfg.keyFields.map(k => (
                <span key={k} className="font-mono caption-1 px-1.5 py-0.5 rounded bg-[var(--surface-bg)] text-[var(--text-secondary)]">{k}</span>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-auto">
              <span className="caption-1 text-[var(--text-secondary)]">
                {cfg.usedByCount} pipeline{cfg.usedByCount !== 1 ? 's' : ''}
              </span>
              <span className="caption-1 text-[var(--text-secondary)]">
                {new Date(cfg.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
