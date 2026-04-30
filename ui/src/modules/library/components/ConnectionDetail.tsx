'use client'

import * as React from 'react'
import {
  useKafkaConnections,
  useClickhouseConnections,
  type KafkaConnection,
  type ClickhouseConnection,
} from '@/src/hooks/useLibraryConnections'
import {
  useKafkaConnectionUsedBy,
  useClickhouseConnectionUsedBy,
} from '@/src/hooks/useLibraryDetail'
import { Crumbs } from '@/src/components/ui/crumbs'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Skeleton } from '@/src/components/ui/skeleton'
import { EmptyState } from '@/src/components/ui/empty-state'
import { UsedByList } from './UsedByList'
import { KafkaConnectionFormModal } from './KafkaConnectionFormModal'
import { ClickHouseConnectionFormModal } from './ClickHouseConnectionFormModal'

type ConnectionKind = 'kafka' | 'clickhouse'

type ConnectionDetailProps = {
  kind: ConnectionKind
  id: string
}

export function ConnectionDetail({ kind, id }: ConnectionDetailProps) {
  const [editOpen, setEditOpen] = React.useState(false)

  const kafka = useKafkaConnections()
  const ch = useClickhouseConnections()
  const kafkaUsed = useKafkaConnectionUsedBy(kind === 'kafka' ? id : null)
  const chUsed = useClickhouseConnectionUsedBy(kind === 'clickhouse' ? id : null)

  const connection: KafkaConnection | ClickhouseConnection | null =
    kind === 'kafka'
      ? (kafka.data?.find((c) => c.id === id) ?? null)
      : (ch.data?.find((c) => c.id === id) ?? null)

  const usedBy = kind === 'kafka' ? kafkaUsed.data : chUsed.data
  const usedByLoading = kind === 'kafka' ? kafkaUsed.isLoading : chUsed.isLoading

  const listLoading = kind === 'kafka' ? kafka.isLoading : ch.isLoading

  if (listLoading && !connection) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton width={240} height={20} />
        <Skeleton width="100%" height={120} />
      </div>
    )
  }

  if (!connection) {
    return (
      <EmptyState
        heading="Connection not found"
        copy="This connection may have been deleted or you don't have access to it."
        cta={{ label: 'Back to Library', href: '/library' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <Crumbs
        crumbs={[
          { label: 'Library', href: '/library' },
          {
            label: kind === 'kafka' ? 'Kafka connections' : 'ClickHouse connections',
            href: '/library',
          },
          { label: connection.name },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="title-2 text-[var(--text-primary)]">{connection.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{kind === 'kafka' ? 'Kafka' : 'ClickHouse'}</Badge>
            <Badge variant="outline">live · not versioned</Badge>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
      </div>

      <Card variant="dark" className="p-5">
        <h2 className="title-6 text-[var(--text-primary)] mb-3">Connection</h2>
        <pre className="mono-2 rounded bg-[var(--color-background-elevation-base)] border border-[var(--surface-border)] p-3 text-[var(--color-foreground-neutral-faded)] overflow-x-auto">
          {JSON.stringify(redactConfig(connection.config), null, 2)}
        </pre>
      </Card>

      <Card variant="dark" className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="title-6 text-[var(--text-primary)]">Used by</h2>
          <Badge variant="secondary">{usedBy.length}</Badge>
        </div>
        <UsedByList
          usedBy={usedBy}
          loading={usedByLoading}
          resourceLabel="this connection"
        />
      </Card>

      {kind === 'kafka' && (
        <KafkaConnectionFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            kafka.mutate()
          }}
          connection={connection as KafkaConnection}
        />
      )}
      {kind === 'clickhouse' && (
        <ClickHouseConnectionFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => ch.mutate()}
          connection={connection as ClickhouseConnection}
        />
      )}
    </div>
  )
}

function redactConfig(config: unknown): unknown {
  if (!config || typeof config !== 'object') return config
  const cloned = JSON.parse(JSON.stringify(config))
  const REDACT = ['password', 'apiKey', 'apiSecret', 'token', 'sasl_password']
  function walk(o: Record<string, unknown> | unknown): void {
    if (!o || typeof o !== 'object') return
    const obj = o as Record<string, unknown>
    for (const k of Object.keys(obj)) {
      if (REDACT.includes(k)) obj[k] = '••••'
      else walk(obj[k])
    }
  }
  walk(cloned)
  return cloned
}
