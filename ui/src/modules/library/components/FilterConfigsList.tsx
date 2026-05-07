import Link from 'next/link'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryFilterConfig, LibraryFilterRule, LibraryFilterRuleGroup } from '@/src/hooks/useLibraryConnections'

function countRules(rules: Array<LibraryFilterRule | LibraryFilterRuleGroup>): number {
  return rules.reduce((acc, r) => {
    if ('rules' in r) return acc + countRules((r as LibraryFilterRuleGroup).rules)
    return acc + 1
  }, 0)
}

type Props = { configs: LibraryFilterConfig[] }

export function FilterConfigsList({ configs }: Props) {
  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="body-3 text-[var(--text-secondary)]">No filter configs yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {configs.map(cfg => {
        const ruleCount = countRules(cfg.rules)
        return (
          <Link key={cfg.id} href={`/library/filter/${cfg.id}`} className="block">
            <Card variant="dark" className="p-4 h-full hover:border-[var(--surface-border-hover)] transition-colors">
              <div className="flex items-start justify-between mb-2">
                <span className="title-6 text-[var(--text-primary)] truncate">{cfg.name}</span>
                <Badge variant="secondary">{cfg.latestVersion}</Badge>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">{ruleCount} rule{ruleCount !== 1 ? 's' : ''}</Badge>
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
        )
      })}
    </div>
  )
}
