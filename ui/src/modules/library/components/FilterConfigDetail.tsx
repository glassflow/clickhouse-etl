'use client'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryFilterConfig, LibraryFilterRule, LibraryFilterRuleGroup } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'
import { UsedByTable } from './UsedByTable'

const CONJ_LABELS: Record<string, string> = { and: 'and', or: 'or' }

function ConjLabel({ label, first = false }: { label: string; first?: boolean }) {
  return (
    <span
      className={[
        'caption-1 w-10 shrink-0 text-right pr-2',
        first ? 'text-[var(--text-tertiary)]' : 'text-[var(--color-orange-300)]',
      ].join(' ')}
    >
      {first ? 'where' : CONJ_LABELS[label] ?? label}
    </span>
  )
}

function RuleRow({ rule, conjLabel, first = false }: { rule: LibraryFilterRule; conjLabel?: string; first?: boolean }) {
  const isNullOp = rule.operator === 'is_null' || rule.operator === 'is_not_null'
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[var(--surface-border)] last:border-0">
      <ConjLabel label={conjLabel ?? 'and'} first={first} />
      <span className="font-mono body-3 text-[var(--text-primary)] min-w-[80px]">{rule.field}</span>
      <span className="caption-1 text-[var(--text-tertiary)] bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded px-1.5 py-0.5 whitespace-nowrap">
        {rule.operator.replace(/_/g, ' ')}
      </span>
      {!isNullOp && rule.value !== null && (
        <span className="body-3 font-mono" style={{ color: 'var(--color-green-400)' }}>
          &quot;{rule.value}&quot;
        </span>
      )}
    </div>
  )
}

function RuleGroup({ group, depth = 0, conjLabel, first = false }: {
  group: LibraryFilterRuleGroup
  depth?: number
  conjLabel?: string
  first?: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-2 py-1.5">
        <ConjLabel label={conjLabel ?? 'and'} first={first} />
        <span className="caption-1 text-[var(--text-tertiary)]">
          ({group.combinator === 'or' ? 'match any of' : 'match all of'})
        </span>
      </div>
      <div className={`pl-12 border-l border-[var(--surface-border)] ml-5`}>
        {group.rules.map((r, i) => (
          'rules' in r
            ? <RuleGroup
                key={r.id}
                group={r as LibraryFilterRuleGroup}
                depth={depth + 1}
                conjLabel={group.combinator}
                first={i === 0}
              />
            : <RuleRow
                key={r.id}
                rule={r as LibraryFilterRule}
                conjLabel={group.combinator}
                first={i === 0}
              />
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="title-6 text-[var(--text-primary)]">Filter rules</h2>
              <span className="caption-1 text-[var(--text-tertiary)]">
                {config.rules.length} condition{config.rules.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div>
              {config.rules.map((r, i) => (
                'rules' in r
                  ? <RuleGroup key={r.id} group={r as LibraryFilterRuleGroup} conjLabel="and" first={i === 0} />
                  : <RuleRow key={r.id} rule={r as LibraryFilterRule} conjLabel="and" first={i === 0} />
              ))}
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Used by
              {usedBy.length > 0 && <span className="ml-2 caption-1 text-[var(--text-secondary)]">{usedBy.length} pipeline{usedBy.length !== 1 ? 's' : ''}</span>}
            </h2>
            <UsedByTable entries={usedBy} />
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
