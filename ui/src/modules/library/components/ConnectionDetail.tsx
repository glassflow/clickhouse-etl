'use client'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import type { LibraryConnection } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

const PASSWORD_KEYS = new Set(['password', 'secret', 'token', 'apiKey', 'api_key', 'sasl_password'])

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-[var(--surface-border)] last:border-0">
      <span className="body-3 text-[var(--text-secondary)] w-40 shrink-0">{label}</span>
      <span className="body-3 text-[var(--text-primary)] font-mono break-all">{value}</span>
    </div>
  )
}

function maskValue(key: string, value: unknown): string {
  if (PASSWORD_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
    return '••••••••'
  }
  return String(value ?? '—')
}

function configLabel(key: string): string {
  const labels: Record<string, string> = {
    bootstrapServers: 'Bootstrap servers',
    brokers: 'Brokers',
    authMethod: 'Auth method',
    username: 'Username',
    password: 'Password',
    host: 'Host',
    port: 'Port',
    database: 'Database',
    secure: 'TLS / secure',
    protocol: 'Protocol',
    mechanism: 'Mechanism',
  }
  return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

function UsedByPill({ entry }: { entry: UsedByEntry }) {
  const colorMap = { ok: 'success', warn: 'warning', err: 'error' } as const
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--surface-bg)] border border-[var(--surface-border)]">
      <Badge variant={colorMap[entry.health]} className="w-2 h-2 p-0 rounded-full" />
      <span className="body-3 text-[var(--text-primary)]">{entry.pipelineName}</span>
      {entry.drift && (
        <span className="caption-1 text-[var(--color-yellow-500)]">drift</span>
      )}
    </div>
  )
}

type Props = {
  connection: LibraryConnection
  usedBy: UsedByEntry[]
}

export function ConnectionDetail({ connection, usedBy }: Props) {
  const router = useRouter()
  const configEntries = Object.entries(connection.config ?? {})

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeftIcon size={16} />
        </Button>
        <span className="w-5 h-5 rounded bg-[var(--surface-border)]" />
        <h1 className="title-4 text-[var(--text-primary)]">{connection.name}</h1>
        <Badge variant="secondary" className="capitalize">{connection.kind}</Badge>
        {connection.description && (
          <span className="body-3 text-[var(--text-secondary)]">{connection.description}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Connection</h2>
            <div>
              {configEntries.map(([k, v]) => (
                <KVRow key={k} label={configLabel(k)} value={maskValue(k, v)} />
              ))}
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Used by
              {usedBy.length > 0 && (
                <span className="ml-2 caption-1 text-[var(--text-secondary)]">{usedBy.length} pipeline{usedBy.length !== 1 ? 's' : ''}</span>
              )}
            </h2>
            {usedBy.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">Not used by any pipeline.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {usedBy.map(e => <UsedByPill key={e.pipelineId} entry={e} />)}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Health</h2>
            <div className="flex items-center gap-2">
              <Badge variant="success">Reachable</Badge>
              <span className="caption-1 text-[var(--text-secondary)]">Last checked just now</span>
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Metadata</h2>
            <KVRow label="Created" value={new Date(connection.createdAt).toLocaleDateString()} />
            <KVRow label="Updated" value={new Date(connection.updatedAt).toLocaleDateString()} />
            {connection.tags.length > 0 && (
              <div className="flex items-start gap-4 py-2.5">
                <span className="body-3 text-[var(--text-secondary)] w-40 shrink-0">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {connection.tags.map(t => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card variant="dark" className="p-5 border border-[var(--color-red-900)]">
            <h2 className="title-6 text-[var(--color-red-400)] mb-3">Danger zone</h2>
            <p className="body-3 text-[var(--text-secondary)] mb-3">
              Deleting this connection will remove it from all pipelines that use it.
            </p>
            <Button variant="destructive" size="sm">Delete connection</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
