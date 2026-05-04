'use client'

import * as React from 'react'
import { useLibrarySchemas } from '@/src/hooks/useLibraryConnections'
import { useSchemaVersions, useSchemaUsedBy } from '@/src/hooks/useLibraryDetail'
import { Crumbs } from '@/src/components/ui/crumbs'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Skeleton } from '@/src/components/ui/skeleton'
import { EmptyState } from '@/src/components/ui/empty-state'
import { SchemaVersionTimeline } from './SchemaVersionTimeline'
import { SchemaDiffViewer } from './SchemaDiffViewer'
import { SchemaVersionPublishModal } from './SchemaVersionPublishModal'
import { UsedByList } from './UsedByList'
import { BulkRolloutModal } from './BulkRolloutModal'
import { notify } from '@/src/notifications'
import { getApiUrl } from '@/src/utils/mock-api'
import type { SemverBump } from '@/src/app/ui-api/library/schemas/[id]/versions/semver-util'
import type { SchemaField } from './SchemaDiffViewer'

type SchemaDetailProps = { id: string }

export function SchemaDetail({ id }: SchemaDetailProps) {
  const schemas = useLibrarySchemas()
  const versions = useSchemaVersions(id)
  const usedBy = useSchemaUsedBy(id)

  const schema = schemas.data?.find((s) => s.id === id) ?? null

  const [publishOpen, setPublishOpen] = React.useState(false)
  const [rolloutOpen, setRolloutOpen] = React.useState(false)
  const [selectedA, setSelectedA] = React.useState<string | null>(null)
  const [selectedB, setSelectedB] = React.useState<string | null>(null)

  // default selection: latest two versions
  React.useEffect(() => {
    if (versions.data.length >= 2 && selectedA === null && selectedB === null) {
      setSelectedA(versions.data[0].id)
      setSelectedB(versions.data[1].id)
    } else if (versions.data.length === 1 && selectedA === null) {
      setSelectedA(versions.data[0].id)
    }
  }, [versions.data, selectedA, selectedB])

  const handleSelect = (slot: 'a' | 'b', versionId: string) => {
    if (slot === 'a') setSelectedA(versionId || null)
    else setSelectedB(versionId || null)
  }

  const versionA = versions.data.find((v) => v.id === selectedA) ?? null
  const versionB = versions.data.find((v) => v.id === selectedB) ?? null
  const showDiff = versionA !== null && versionB !== null && versionA.id !== versionB.id

  // newer of (A, B) is shown right; older shown left
  const [oldVer, newVer] =
    showDiff && versionA && versionB
      ? versionA.createdAt < versionB.createdAt
        ? [versionA, versionB]
        : [versionB, versionA]
      : [null, null]

  const handlePublish = async (data: {
    bump: SemverBump
    changeSummary: string | undefined
    fields: SchemaField[]
  }) => {
    const res = await fetch(getApiUrl(`library/schemas/${id}/versions`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as
        | { error?: { formErrors?: string[] } | string }
        | null
      const fallback = 'Unknown error'
      let message = fallback
      const e = err?.error
      if (typeof e === 'string') message = e
      else if (e && typeof e === 'object' && 'formErrors' in e && e.formErrors)
        message = e.formErrors.join(', ')
      notify({ variant: 'error', title: 'Publish failed', description: message })
      throw new Error('publish failed')
    }
    notify({ variant: 'success', title: 'New version published' })
    versions.mutate()
    schemas.mutate()
  }

  if (schemas.isLoading && !schema) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton width={240} height={20} />
        <Skeleton width="100%" height={200} />
      </div>
    )
  }
  if (!schema) {
    return (
      <Card variant="dark" className="p-8 text-center">
        <p className="body-3 text-[var(--text-secondary)]">Schema not found.</p>
      </Card>
    )
  }

  const latestVersion = versions.data[0]?.version ?? null

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <Crumbs
        crumbs={[
          { label: 'Library', href: '/library' },
          { label: 'Schemas', href: '/library' },
          { label: schema.name },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="title-2 text-[var(--text-primary)]">{schema.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Schema</Badge>
            {latestVersion && (
              <Badge variant="outline">
                latest: <span className="mono-2 ml-1">{latestVersion}</span>
              </Badge>
            )}
            <Badge variant="outline">pinned per pipeline</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {versions.data.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRolloutOpen(true)}
              disabled={!latestVersion}
            >
              Roll out to pipelines
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setPublishOpen(true)}>
            Publish new version
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <Card variant="dark" className="p-4">
          <h2 className="title-6 text-[var(--text-primary)] mb-3">Versions</h2>
          {versions.isLoading ? (
            <Skeleton width="100%" height={120} />
          ) : versions.error ? (
            <EmptyState
              heading="Couldn't load versions"
              copy={String(versions.error)}
              cta={{ label: 'Retry', onClick: () => versions.mutate() }}
            />
          ) : versions.data.length === 0 ? (
            <EmptyState
              heading="No versions yet"
              copy="Publish to create v1.0.0 — once published, all references in pipelines will pin to that version."
              cta={{ label: 'Publish new version', onClick: () => setPublishOpen(true) }}
            />
          ) : (
            <SchemaVersionTimeline
              versions={versions.data}
              selectedA={selectedA}
              selectedB={selectedB}
              onSelect={handleSelect}
            />
          )}
        </Card>

        <Card variant="dark" className="p-5">
          <h2 className="title-6 text-[var(--text-primary)] mb-3">Diff</h2>
          {showDiff && oldVer && newVer ? (
            <SchemaDiffViewer
              oldVersion={{ version: oldVer.version, fields: oldVer.fields }}
              newVersion={{ version: newVer.version, fields: newVer.fields }}
            />
          ) : (
            <p className="body-3 text-[var(--text-secondary)]">
              Select two versions in the timeline to compare.
            </p>
          )}
        </Card>
      </div>

      <Card variant="dark" className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="title-6 text-[var(--text-primary)]">Used by</h2>
          <Badge variant="secondary">{usedBy.data.length}</Badge>
        </div>
        <UsedByList
          usedBy={usedBy.data}
          loading={usedBy.isLoading}
          resourceLabel="this schema"
        />
      </Card>

      <SchemaVersionPublishModal
        open={publishOpen}
        latestVersion={latestVersion}
        currentFields={(schema.fields as SchemaField[]) ?? []}
        onClose={() => setPublishOpen(false)}
        onPublish={handlePublish}
      />

      <BulkRolloutModal
        open={rolloutOpen}
        schemaId={id}
        toVersion={latestVersion ?? '1.0.0'}
        onClose={() => setRolloutOpen(false)}
      />
    </div>
  )
}
