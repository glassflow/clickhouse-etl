'use client'
import * as React from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { SchemaVersionTimeline } from './SchemaVersionTimeline'
import { useSchemaVersions } from '@/src/hooks/useLibraryDetail'
import type { LibrarySchema } from '@/src/hooks/useLibraryConnections'
import type { UsedByEntry } from '@/src/hooks/useLibraryDetail'

function UsedByRow({ entry }: { entry: UsedByEntry }) {
  const colorMap = { ok: 'success', warn: 'warning', err: 'error' } as const
  return (
    <tr className="border-b border-[var(--surface-border)] last:border-0">
      <td className="py-2.5 pr-4">
        <span className="body-3 text-[var(--text-primary)]">{entry.pipelineName}</span>
      </td>
      <td className="py-2.5 pr-4">
        {entry.pinnedVersion
          ? <Badge variant="secondary">{entry.pinnedVersion}</Badge>
          : <span className="caption-1 text-[var(--text-secondary)]">latest</span>
        }
      </td>
      <td className="py-2.5 pr-4">
        <Badge variant={colorMap[entry.health]}>{entry.status}</Badge>
      </td>
      <td className="py-2.5">
        {entry.drift && <Badge variant="warning">drift</Badge>}
      </td>
    </tr>
  )
}

type Props = {
  schema: LibrarySchema
  usedBy: UsedByEntry[]
}

export function SchemaDetail({ schema, usedBy }: Props) {
  const router = useRouter()
  const versions = useSchemaVersions(schema.id)
  const [selectedA, setSelectedA] = React.useState<string | null>(null)
  const [selectedB, setSelectedB] = React.useState<string | null>(null)

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeftIcon size={16} />
        </Button>
        <h1 className="title-4 text-[var(--text-primary)]">{schema.name}</h1>
        {schema.latestVersion && <Badge variant="secondary">{schema.latestVersion}</Badge>}
        {schema.hasDrift && <Badge variant="warning">drift</Badge>}
        <Badge variant="outline" className="capitalize">{schema.source}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Fields
              <span className="ml-2 caption-1 text-[var(--text-secondary)]">{schema.fieldCount}</span>
            </h2>
            {schema.fields.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">No fields defined.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Field</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Type</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Nullable</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.fields.map(f => (
                    <tr key={f.name} className="border-b border-[var(--surface-border)] last:border-0">
                      <td className="py-2.5 pr-4 font-mono body-3 text-[var(--text-primary)]">{f.name}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="secondary">{f.type}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 body-3 text-[var(--text-secondary)]">
                        {f.nullable ? 'yes' : 'no'}
                      </td>
                      <td className="py-2.5 body-3 text-[var(--text-secondary)]">
                        {(f as { description?: string }).description ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">
              Used by
              {usedBy.length > 0 && (
                <span className="ml-2 caption-1 text-[var(--text-secondary)]">{usedBy.length}</span>
              )}
            </h2>
            {usedBy.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">Not used by any pipeline.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Pipeline</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Version</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2 pr-4">Status</th>
                    <th className="text-left caption-1 text-[var(--text-secondary)] pb-2">Drift</th>
                  </tr>
                </thead>
                <tbody>
                  {usedBy.map(e => <UsedByRow key={e.pipelineId} entry={e} />)}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Metadata</h2>
            <div className="flex flex-col">
              {[
                ['Source', schema.source],
                ['Created', new Date(schema.createdAt).toLocaleDateString()],
                ['Updated', new Date(schema.updatedAt).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start gap-4 py-2 border-b border-[var(--surface-border)] last:border-0">
                  <span className="body-3 text-[var(--text-secondary)] w-24 shrink-0">{label}</span>
                  <span className="body-3 text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
              {schema.tags.length > 0 && (
                <div className="flex items-start gap-4 py-2">
                  <span className="body-3 text-[var(--text-secondary)] w-24 shrink-0">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {schema.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card variant="dark" className="p-5">
            <h2 className="title-6 text-[var(--text-primary)] mb-3">Version history</h2>
            {versions.data.length === 0 ? (
              <p className="body-3 text-[var(--text-secondary)]">No versions published yet.</p>
            ) : (
              <SchemaVersionTimeline
                versions={versions.data}
                selectedA={selectedA}
                selectedB={selectedB}
                onSelect={handleSelect}
              />
            )}
          </Card>

          <Card variant="dark" className="p-5 border border-[var(--color-red-900)]">
            <h2 className="title-6 text-[var(--color-red-400)] mb-3">Danger zone</h2>
            <p className="body-3 text-[var(--text-secondary)] mb-3">
              Deleting this schema will remove it from all pipelines that reference it.
            </p>
            <Button variant="destructive" size="sm">Delete schema</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
