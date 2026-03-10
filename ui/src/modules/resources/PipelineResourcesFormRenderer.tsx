'use client'

import React from 'react'
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField } from '@/src/components/ui/form'
import { Input } from '@/src/components/ui/input'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { HINT_K8S_QUANTITY, HINT_NATS_MAX_AGE, HINT_NATS_MAX_BYTES, HINT_REPLICAS } from './quantity-parser'

/** One fixed-height slot: hint (gray) when no error, FormMessage (red) when error. Keeps alignment across columns. */
function FieldHintAndMessage({ hint }: { hint?: string }) {
  const { error } = useFormField()
  return (
    <div className="min-h-8">
      {error ? (
        <FormMessage />
      ) : hint ? (
        <FormDescription className="text-xs text-[var(--color-foreground-neutral-faded)]">
          {hint}
        </FormDescription>
      ) : null}
    </div>
  )
}

interface ComponentSectionProps {
  title: string
  prefix: string
  fields: Array<{
    name: string
    label: string
    placeholder: string
    hint?: string
    immutablePaths?: string[]
  }>
  immutablePaths: string[]
}

function ComponentSection({ title, prefix, fields, immutablePaths }: ComponentSectionProps) {
  // API uses "nats/stream/maxAge", form uses "nats.stream.maxAge"
  const toApiPath = (p: string) => p.replace(/\./g, '/')
  const isImmutable = (path: string) => immutablePaths.includes(toApiPath(path))

  return (
    <div className="space-y-4 rounded-lg border border-[var(--color-border-neutral-faded)] bg-[var(--color-background-elevation-raised)] p-4">
      <h4 className="text-sm font-semibold text-[var(--color-foreground-neutral)]">{title}</h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(({ name, label, placeholder, hint }) => {
          const fieldPath = `${prefix}.${name}`
          const disabled = isImmutable(fieldPath)

          return (
            <FormField
              key={fieldPath}
              name={fieldPath}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    {label}
                    {disabled && (
                      <LockClosedIcon className="h-3.5 w-3.5 text-[var(--color-foreground-neutral-faded)]" title="Immutable after creation" />
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={placeholder}
                      disabled={disabled}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                  <FieldHintAndMessage hint={hint} />
                </FormItem>
              )}
            />
          )
        })}
      </div>
    </div>
  )
}

interface PipelineResourcesFormRendererProps {
  pipelineShape: {
    hasJoin: boolean
    hasTransform: boolean
  }
  immutablePaths: string[]
}

export function PipelineResourcesFormRenderer({
  pipelineShape,
  immutablePaths,
}: PipelineResourcesFormRendererProps) {
  return (
    <div className="space-y-6">
      {/* NATS Stream */}
      <ComponentSection
        title="NATS Stream"
        prefix="nats.stream"
        immutablePaths={immutablePaths}
        fields={[
          { name: 'maxAge', label: 'Max Age', placeholder: 'e.g. 24h', hint: HINT_NATS_MAX_AGE },
          { name: 'maxBytes', label: 'Max Bytes', placeholder: 'e.g. 10Gi, 100GB', hint: HINT_NATS_MAX_BYTES },
        ]}
      />

      {/* Ingestor */}
      {pipelineShape.hasJoin ? (
        <>
          <ComponentSection
            title="Ingestor (Left)"
            prefix="ingestor.left"
            immutablePaths={immutablePaths}
            fields={[
              { name: 'requests.cpu', label: 'CPU Request', placeholder: 'e.g. 100m, 1', hint: HINT_K8S_QUANTITY },
              { name: 'requests.memory', label: 'Memory Request', placeholder: 'e.g. 128Mi, 1Gi', hint: HINT_K8S_QUANTITY },
              { name: 'limits.cpu', label: 'CPU Limit', placeholder: 'e.g. 1500m, 2', hint: HINT_K8S_QUANTITY },
              { name: 'limits.memory', label: 'Memory Limit', placeholder: 'e.g. 1.5Gi', hint: HINT_K8S_QUANTITY },
              { name: 'replicas', label: 'Replicas', placeholder: '1', hint: HINT_REPLICAS },
            ]}
          />
          <ComponentSection
            title="Ingestor (Right)"
            prefix="ingestor.right"
            immutablePaths={immutablePaths}
            fields={[
              { name: 'requests.cpu', label: 'CPU Request', placeholder: 'e.g. 100m, 1', hint: HINT_K8S_QUANTITY },
              { name: 'requests.memory', label: 'Memory Request', placeholder: 'e.g. 128Mi, 1Gi', hint: HINT_K8S_QUANTITY },
              { name: 'limits.cpu', label: 'CPU Limit', placeholder: 'e.g. 1500m, 2', hint: HINT_K8S_QUANTITY },
              { name: 'limits.memory', label: 'Memory Limit', placeholder: 'e.g. 1.5Gi', hint: HINT_K8S_QUANTITY },
              { name: 'replicas', label: 'Replicas', placeholder: '1', hint: HINT_REPLICAS },
            ]}
          />
        </>
      ) : (
        <ComponentSection
          title="Ingestor"
          prefix="ingestor.base"
          immutablePaths={immutablePaths}
          fields={[
            { name: 'requests.cpu', label: 'CPU Request', placeholder: 'e.g. 100m, 1', hint: HINT_K8S_QUANTITY },
            { name: 'requests.memory', label: 'Memory Request', placeholder: 'e.g. 128Mi, 1Gi', hint: HINT_K8S_QUANTITY },
            { name: 'limits.cpu', label: 'CPU Limit', placeholder: 'e.g. 1500m, 2', hint: HINT_K8S_QUANTITY },
            { name: 'limits.memory', label: 'Memory Limit', placeholder: 'e.g. 1.5Gi', hint: HINT_K8S_QUANTITY },
            { name: 'replicas', label: 'Replicas', placeholder: '1', hint: HINT_REPLICAS },
          ]}
        />
      )}

      {/* Join (only when join enabled) */}
      {pipelineShape.hasJoin && (
        <ComponentSection
          title="Join"
          prefix="join"
          immutablePaths={immutablePaths}
          fields={[
            { name: 'requests.cpu', label: 'CPU Request', placeholder: 'e.g. 100m, 1', hint: HINT_K8S_QUANTITY },
            { name: 'requests.memory', label: 'Memory Request', placeholder: 'e.g. 128Mi, 1Gi', hint: HINT_K8S_QUANTITY },
            { name: 'limits.cpu', label: 'CPU Limit', placeholder: 'e.g. 1500m, 2', hint: HINT_K8S_QUANTITY },
            { name: 'limits.memory', label: 'Memory Limit', placeholder: 'e.g. 1.5Gi', hint: HINT_K8S_QUANTITY },
          ]}
        />
      )}

      {/* Sink */}
      <ComponentSection
        title="Sink"
        prefix="sink"
        immutablePaths={immutablePaths}
        fields={[
          { name: 'requests.cpu', label: 'CPU Request', placeholder: 'e.g. 100m, 1', hint: HINT_K8S_QUANTITY },
          { name: 'requests.memory', label: 'Memory Request', placeholder: 'e.g. 128Mi, 1Gi', hint: HINT_K8S_QUANTITY },
          { name: 'limits.cpu', label: 'CPU Limit', placeholder: 'e.g. 1500m, 2', hint: HINT_K8S_QUANTITY },
          { name: 'limits.memory', label: 'Memory Limit', placeholder: 'e.g. 1.5Gi', hint: HINT_K8S_QUANTITY },
          { name: 'replicas', label: 'Replicas', placeholder: '1', hint: HINT_REPLICAS },
        ]}
      />

      {/* Transform (only when transform/dedup enabled) */}
      {pipelineShape.hasTransform && (
        <ComponentSection
          title="Transform / Dedup"
          prefix="transform"
          immutablePaths={immutablePaths}
          fields={[
            { name: 'requests.cpu', label: 'CPU Request', placeholder: 'e.g. 100m, 1', hint: HINT_K8S_QUANTITY },
            { name: 'requests.memory', label: 'Memory Request', placeholder: 'e.g. 128Mi, 1Gi', hint: HINT_K8S_QUANTITY },
            { name: 'limits.cpu', label: 'CPU Limit', placeholder: 'e.g. 1500m, 2', hint: HINT_K8S_QUANTITY },
            { name: 'limits.memory', label: 'Memory Limit', placeholder: 'e.g. 1.5Gi', hint: HINT_K8S_QUANTITY },
            { name: 'storage.size', label: 'Storage Size', placeholder: 'e.g. 10Gi, 40Gi', hint: HINT_K8S_QUANTITY },
            { name: 'replicas', label: 'Replicas', placeholder: '1', hint: HINT_REPLICAS },
          ]}
        />
      )}
    </div>
  )
}
