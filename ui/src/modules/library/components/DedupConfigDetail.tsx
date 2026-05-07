'use client'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryDedupConfig } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-[var(--surface-border)] last:border-0">
      <span className="body-3 text-[var(--text-secondary)] w-44 shrink-0">{label}</span>
      <span className="body-3 text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

type Props = {
  config: LibraryDedupConfig
  usedBy: UsedByEntry[]
}

export function DedupConfigDetail({ config, usedBy }: Props) {
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
        {config.hasDrift && <Badge variant="warning">drift</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Configuration</h2>
            <KVRow label="Window type" value={config.windowType} />
            <KVRow label="Window duration" value={config.windowDuration} />
            <KVRow label="Time attribute" value={config.timeAttribute.replace(/_/g, ' ')} />
            <KVRow label="On duplicate" value={config.onDuplicate.replace(/_/g, ' ')} />
            <KVRow label="Late event policy" value={config.lateEventPolicy.replace(/_/g, ' ')} />
            <KVRow label="State backend" value={config.stateBackend} />
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Key fields</h2>
            <div className="flex flex-wrap gap-2">
              {config.keyFields.map(k => (
                <span key={k} className="font-mono body-3 px-2 py-1 rounded bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--text-primary)]">{k}</span>
              ))}
              {config.secondaryKeyFields.length > 0 && (
                <>
                  <span className="body-3 text-[var(--text-secondary)]">secondary:</span>
                  {config.secondaryKeyFields.map(k => (
                    <span key={k} className="font-mono body-3 px-2 py-1 rounded bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--text-secondary)]">{k}</span>
                  ))}
                </>
              )}
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
            <KVRow label="Created" value={new Date(config.createdAt).toLocaleDateString()} />
            <KVRow label="Updated" value={new Date(config.updatedAt).toLocaleDateString()} />
            {config.tags.length > 0 && (
              <div className="flex items-start gap-4 py-2">
                <span className="body-3 text-[var(--text-secondary)] w-44 shrink-0">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {config.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              </div>
            )}
          </Card>

          <Card variant="dark" className="p-5 border border-[var(--color-red-900)]">
            <h2 className="title-6 text-[var(--color-red-400)] mb-3">Danger zone</h2>
            <p className="body-3 text-[var(--text-secondary)] mb-3">
              Deleting this config will remove it from all pipelines that use it.
            </p>
            <Button variant="destructive" size="sm">Delete config</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
