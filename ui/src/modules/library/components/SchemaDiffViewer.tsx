'use client'

import * as React from 'react'
import { cn } from '@/src/utils/common.client'

export type SchemaField = { name: string; type: string; nullable: boolean }
export type DiffKind = 'unchanged' | 'changed' | 'added' | 'removed'

export type FieldDiff = {
  name: string
  kind: DiffKind
  oldField?: SchemaField
  newField?: SchemaField
}

export function computeFieldDiff(
  oldFields: SchemaField[],
  newFields: SchemaField[],
): FieldDiff[] {
  const oldMap = new Map(oldFields.map((f) => [f.name, f]))
  const newMap = new Map(newFields.map((f) => [f.name, f]))
  const allNames = Array.from(new Set([...oldMap.keys(), ...newMap.keys()]))

  return allNames.map((name) => {
    const oldField = oldMap.get(name)
    const newField = newMap.get(name)
    if (!oldField) return { name, kind: 'added' as const, newField }
    if (!newField) return { name, kind: 'removed' as const, oldField }
    const same = oldField.type === newField.type && oldField.nullable === newField.nullable
    return { name, kind: (same ? 'unchanged' : 'changed') as DiffKind, oldField, newField }
  })
}

type SchemaDiffViewerProps = {
  oldVersion: { version: string; fields: SchemaField[] }
  newVersion: { version: string; fields: SchemaField[] }
  className?: string
}

const KIND_TINT: Record<DiffKind, string> = {
  unchanged: 'text-[var(--text-secondary)]',
  changed: 'text-[var(--obs-drift-minor)]',
  added: 'text-[var(--color-foreground-positive)]',
  removed: 'text-[var(--color-foreground-critical)]',
}

const KIND_PREFIX: Record<DiffKind, string> = {
  unchanged: ' ',
  changed: '~',
  added: '+',
  removed: '−',
}

export function SchemaDiffViewer({ oldVersion, newVersion, className }: SchemaDiffViewerProps) {
  const diff = React.useMemo(
    () => computeFieldDiff(oldVersion.fields, newVersion.fields),
    [oldVersion.fields, newVersion.fields],
  )

  const counts = diff.reduce(
    (acc, d) => {
      acc[d.kind] = (acc[d.kind] ?? 0) + 1
      return acc
    },
    {} as Record<DiffKind, number>,
  )

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-3 caption-1 text-[var(--text-secondary)]">
        <span>
          <span className="mono-2">{oldVersion.version}</span> →{' '}
          <span className="mono-2">{newVersion.version}</span>
        </span>
        <span className="text-[var(--color-foreground-positive)]">
          +{counts.added ?? 0} added
        </span>
        <span className="text-[var(--color-foreground-critical)]">
          −{counts.removed ?? 0} removed
        </span>
        <span className="text-[var(--obs-drift-minor)]">~{counts.changed ?? 0} changed</span>
      </div>

      <div className="rounded-md border border-[var(--surface-border)] divide-y divide-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)]">
        {diff.map((d) => (
          <div
            key={d.name}
            className={cn(
              'grid grid-cols-[24px_1fr_1fr] items-center gap-3 px-3 py-2 mono-1',
              KIND_TINT[d.kind],
            )}
            data-diff-kind={d.kind}
          >
            <span aria-hidden="true">{KIND_PREFIX[d.kind]}</span>
            <span>
              {d.oldField ? (
                <>
                  <span className="font-medium">{d.name}</span>
                  <span className="text-[var(--color-foreground-neutral-faded)]">
                    : {d.oldField.type}
                    {d.oldField.nullable ? '?' : ''}
                  </span>
                </>
              ) : (
                <span className="text-[var(--color-foreground-neutral-faded)]">—</span>
              )}
            </span>
            <span>
              {d.newField ? (
                <>
                  <span className="font-medium">{d.newField.name}</span>
                  <span className="text-[var(--color-foreground-neutral-faded)]">
                    : {d.newField.type}
                    {d.newField.nullable ? '?' : ''}
                  </span>
                </>
              ) : (
                <span className="text-[var(--color-foreground-neutral-faded)]">—</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
