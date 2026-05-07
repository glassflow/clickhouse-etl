'use client'
import { ArrowLeftIcon, CheckCircle2Icon, PencilIcon, ActivityIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { LibraryTypeGlyph } from './LibraryTypeGlyph'
import type { LibraryConnection } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'
import { UsedByTable } from './UsedByTable'

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

type Props = {
  connection: LibraryConnection
  usedBy: UsedByEntry[]
}

export function ConnectionDetail({ connection, usedBy }: Props) {
  const router = useRouter()
  const configEntries = Object.entries(connection.config ?? {})

  const isKafka = connection.kind === 'kafka'
  const glyphType = isKafka ? 'kafka' : 'clickhouse'

  const kafkaHealthRows = [
    { label: 'Last tested', value: '2 min ago · ok' },
    { label: 'Broker latency', value: '12 ms (avg)' },
    { label: 'Topics visible', value: '247' },
    { label: 'Active consumers', value: String(usedBy.length) },
  ]
  const chHealthRows = [
    { label: 'Last tested', value: '4 min ago · ok' },
    { label: 'Insert latency p95', value: '180 ms' },
    { label: 'Server version', value: '24.3.2.1' },
    { label: 'Replicas', value: '3' },
  ]
  const healthRows = isKafka ? kafkaHealthRows : chHealthRows

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
            <ArrowLeftIcon size={16} />
          </Button>
          <LibraryTypeGlyph type={glyphType} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="title-4 text-[var(--text-primary)]">{connection.name}</h1>
              <Badge variant="success">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-green-500)] mr-1.5" />
                reachable
              </Badge>
            </div>
            {connection.description && (
              <p className="body-3 text-[var(--text-secondary)] mt-0.5">{connection.description}</p>
            )}
            {connection.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {connection.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm">
            <CheckCircle2Icon size={13} className="mr-1.5" />
            Test connection
          </Button>
          <Button variant="primary" size="sm">
            <PencilIcon size={13} className="mr-1.5" />
            Edit
          </Button>
        </div>
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
            <UsedByTable entries={usedBy} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ActivityIcon size={14} className="text-[var(--text-tertiary)]" />
              <h2 className="title-6 text-[var(--text-primary)]">Health</h2>
            </div>
            {healthRows.map(({ label, value }) => (
              <KVRow key={label} label={label} value={value} />
            ))}
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Metadata</h2>
            <KVRow label="Created" value={new Date(connection.createdAt).toLocaleDateString()} />
            <KVRow label="Updated" value={new Date(connection.updatedAt).toLocaleDateString()} />
            {connection.folderId && (
              <KVRow label="Folder" value={connection.folderId} />
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
