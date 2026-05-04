'use client'

import React from 'react'
import type { OtlpSchemaField } from '@/src/modules/otlp/constants'

interface OtlpSchemaPreviewProps {
  fields: OtlpSchemaField[]
  signalLabel: string
}

export function OtlpSchemaPreview({ fields, signalLabel }: OtlpSchemaPreviewProps) {
  if (fields.length === 0) return null

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">
        {signalLabel} Schema ({fields.length} fields)
      </h4>
      <div className="rounded-lg border border-[var(--color-border-neutral-faded)] bg-[var(--color-background-elevation-raised)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-neutral-faded)]">
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-foreground-neutral-faded)] uppercase tracking-wider">
                Field Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-foreground-neutral-faded)] uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr
                key={field.name}
                className={index % 2 === 0
                  ? 'bg-[var(--color-background-elevation-raised)]'
                  : 'bg-[var(--color-background-elevation-base)]'}
              >
                <td className="px-4 py-1.5 font-mono text-xs text-[var(--color-foreground-neutral)]">
                  {field.name}
                </td>
                <td className="px-4 py-1.5 text-xs text-[var(--color-foreground-neutral-faded)]">
                  {field.type}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
