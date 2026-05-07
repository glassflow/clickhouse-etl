'use client'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryFilterConfig, LibraryFilterRule, LibraryFilterRuleGroup } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

function RuleRow({ rule }: { rule: LibraryFilterRule }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[var(--surface-border)] last:border-0">
      <span className="font-mono body-3 text-[var(--text-primary)]">{rule.field}</span>
      <Badge variant="outline">{rule.operator.replace(/_/g, ' ')}</Badge>
      {rule.value !== null && (
        <span className="body-3 text-[var(--text-secondary)]">{rule.value}</span>
      )}
    </div>
  )
}

function RuleGroup({ group, depth = 0 }: { group: LibraryFilterRuleGroup; depth?: number }) {
  return (
    <div className={depth > 0 ? 'pl-4' : ''}>
      <Badge variant="secondary" className="mb-2">{group.combinator.toUpperCase()}</Badge>
      <div className="pl-3 border-l-2 border-[var(--surface-border)]">
        {group.rules.map(r => (
          'rules' in r
            ? <RuleGroup key={r.id} group={r as LibraryFilterRuleGroup} depth={depth + 1} />
            : <RuleRow key={r.id} rule={r as LibraryFilterRule} />
        ))}
      </div>
    </div>
  )
}

type Props = {
  config: LibraryFilterConfig
  usedBy: UsedByEntry[]
}

export function FilterConfigDetail({ config, usedBy }: Props) {
  const router = useRouter()
  const colorMap = { ok: 'success', warn: 'warning', err: 'error' } as const

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeftIcon size={16} />
        </Button>
        <h1 className="title-4 text-[var(--text-primary)]">{config.name}</h1>
        <Badge variant="secondary">{config.latestVersion}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Filter rules</h2>
            <div>
              {config.rules.map(r => (
                'rules' in r
                  ? <RuleGroup key={r.id} group={r as LibraryFilterRuleGroup} />
                  : <RuleRow key={r.id} rule={r as LibraryFilterRule} />
              ))}
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Used by
              {usedBy.length > 0 && <span className="ml-2 caption-1 text-[var(--text-secondary)]">{usedBy.length}</span>}
            </h2>
            {usedBy.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">Not used by any pipeline.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {usedBy.map(e => (
                  <div key={e.pipelineId} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--surface-bg)] border border-[var(--surface-border)]">
                    <Badge variant={colorMap[e.health]} className="w-2 h-2 p-0 rounded-full" />
                    <span className="body-3 text-[var(--text-primary)]">{e.pipelineName}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Metadata</h2>
            {[
              ['Created', new Date(config.createdAt).toLocaleDateString()],
              ['Updated', new Date(config.updatedAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-4 py-2 border-b border-[var(--surface-border)] last:border-0">
                <span className="body-3 text-[var(--text-secondary)] w-24 shrink-0">{label}</span>
                <span className="body-3 text-[var(--text-primary)]">{value}</span>
              </div>
            ))}
          </Card>

          <Card variant="dark" className="p-5 border border-[var(--color-red-900)]">
            <h2 className="title-6 text-[var(--color-red-400)] mb-3">Danger zone</h2>
            <p className="body-3 text-[var(--text-secondary)] mb-3">
              Deleting this filter will remove it from all pipelines that reference it.
            </p>
            <Button variant="destructive" size="sm">Delete filter</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
