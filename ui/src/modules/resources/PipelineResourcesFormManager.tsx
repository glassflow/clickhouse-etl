'use client'

import React, { useEffect, useRef } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import FormActions from '@/src/components/shared/FormActions'
import { PipelineResourcesFormRenderer } from './PipelineResourcesFormRenderer'
import { pipelineResourcesFormSchema, type PipelineResourcesFormValues } from './pipeline-resources.schema'
import type { PipelineResources } from '@/src/types/pipeline'

function resourcesToFormValues(r: PipelineResources | null): PipelineResourcesFormValues {
  if (!r) return {}
  const ensure = (obj: any) => obj ?? {}
  const str = (v: any) => (v != null ? String(v) : '')
  const ensureComponent = (c: any) =>
    c
      ? {
        requests: ensure(c.requests),
        limits: ensure(c.limits),
        storage: c.storage ? ensure(c.storage) : undefined,
        replicas: c.replicas != null ? c.replicas : undefined,
      }
      : {}
  return {
    nats: r.nats
      ? { stream: { maxAge: str(r.nats.stream?.maxAge), maxBytes: str(r.nats.stream?.maxBytes) } }
      : undefined,
    ingestor: r.ingestor
      ? {
        base: ensureComponent(r.ingestor.base),
        left: ensureComponent(r.ingestor.left),
        right: ensureComponent(r.ingestor.right),
      }
      : undefined,
    join: ensureComponent(r.join),
    sink: { ...ensureComponent(r.sink), replicas: r.sink?.replicas != null ? r.sink.replicas : 1 },
    transform: ensureComponent(r.transform),
  }
}

function formValuesToResources(v: PipelineResourcesFormValues): PipelineResources {
  const prune = (obj: any, key?: string): any => {
    if (obj === null || obj === undefined) return undefined
    if (key === 'replicas' && (typeof obj === 'string' || typeof obj === 'number')) {
      const n = typeof obj === 'string' ? parseInt(obj, 10) : obj
      return isNaN(n) ? undefined : n
    }
    if (typeof obj !== 'object') return obj === '' ? undefined : obj
    const copy: any = {}
    for (const [k, val] of Object.entries(obj)) {
      const pruned = prune(val, k)
      if (pruned !== undefined && pruned !== '') {
        copy[k] = pruned
      }
    }
    return Object.keys(copy).length ? copy : undefined
  }
  const result = prune(v) as PipelineResources
  if (result?.sink && result.sink.replicas === undefined) {
    result.sink = { ...result.sink, replicas: 1 }
  }
  return result
}

interface PipelineResourcesFormManagerProps {
  initialValues: PipelineResourcesFormValues
  pipelineShape: { hasJoin: boolean; hasTransform: boolean; hasDedup: boolean }
  immutablePaths: string[]
  readOnly?: boolean
  standalone?: boolean
  onSave: (resources: PipelineResources) => void | Promise<void>
  onDiscard?: () => void
  toggleEditMode?: () => void
  pipelineActionState?: { isLoading: boolean; lastAction: string | null }
  onClose?: () => void
}

export function PipelineResourcesFormManager({
  initialValues,
  pipelineShape,
  immutablePaths,
  readOnly,
  standalone,
  onSave,
  onDiscard,
  toggleEditMode,
  pipelineActionState,
  onClose,
}: PipelineResourcesFormManagerProps) {
  const originalValuesRef = useRef(initialValues)

  const formMethods = useForm<PipelineResourcesFormValues>({
    resolver: zodResolver(pipelineResourcesFormSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
  })

  const { handleSubmit, reset } = formMethods

  useEffect(() => {
    originalValuesRef.current = initialValues
    reset(initialValues)
  }, [initialValues, reset])

  const handleFormSubmit = handleSubmit((values) => {
    const resources = formValuesToResources(values)
    onSave(resources)
  })

  const handleDiscard = () => {
    reset(originalValuesRef.current)
    onDiscard?.()
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <PipelineResourcesFormRenderer pipelineShape={pipelineShape} immutablePaths={immutablePaths} />
        <FormActions
          readOnly={readOnly}
          standalone={standalone}
          onSubmit={handleFormSubmit}
          onDiscard={handleDiscard}
          toggleEditMode={toggleEditMode}
          pipelineActionState={pipelineActionState}
          onClose={onClose}
          regularText="Continue"
        />
      </form>
    </FormProvider>
  )
}

export { resourcesToFormValues, formValuesToResources }
