'use client'

import React, { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { getResourceDefaults } from '@/src/config/resource-defaults'
import { getPipelineResources, getPipelineResourcesValidation, updatePipelineResources } from '@/src/api/pipeline-api'
import { PipelineResourcesFormManager, resourcesToFormValues } from './PipelineResourcesFormManager'
import { sanitizePipelineResourcesForSubmit } from './utils'
import { StepKeys } from '@/src/config/constants'
import { notify } from '@/src/notifications'
import type { StepBaseProps } from '@/src/modules/pipelines/[id]/step-renderer/stepProps'

export function PipelineResourcesConfigurator({
  onCompleteStep,
  standalone,
  readOnly = false,
  toggleEditMode,
  onCompleteStandaloneEditing,
  pipeline,
  pipelineActionState,
}: StepBaseProps) {
  const { resourcesStore, joinStore, topicsStore, filterStore, transformationStore, deduplicationStore } = useStore()
  const [initialized, setInitialized] = useState(false)
  const [initialValues, setInitialValues] = useState(resourcesToFormValues(null))

  const hasJoin = joinStore?.enabled === true
  const topics = topicsStore?.topics ? Object.values(topicsStore.topics) : []
  const hasTopicDedup = topics.some(
    (t: any, i: number) => deduplicationStore?.getDeduplication?.(i)?.enabled === true
  )
  const hasPipelineDedup = pipeline?.source?.topics?.some((t: any) => t?.deduplication?.enabled === true)
  const hasTransform =
    hasTopicDedup ||
    hasPipelineDedup ||
    filterStore?.filterConfig?.enabled === true ||
    transformationStore?.transformationConfig?.enabled === true ||
    (transformationStore?.transformationConfig?.fields?.length ?? 0) > 0

  const pipelineShape = { hasJoin, hasTransform }
  const immutablePaths = resourcesStore.fields_policy?.immutable ?? []

  useEffect(() => {
    if (standalone && pipeline?.pipeline_id) {
      getPipelineResources(pipeline.pipeline_id)
        .then((res) => {
          resourcesStore.hydrateResources(res.pipeline_resources, res.fields_policy?.immutable ?? [])
          setInitialValues(resourcesToFormValues(res.pipeline_resources))
        })
        .catch(async () => {
          setInitialValues(resourcesToFormValues(pipeline.pipeline_resources ?? null))
          if (pipeline.pipeline_resources) {
            let immutable = pipeline.fields_policy?.immutable ?? []
            if (immutable.length === 0 && pipeline.pipeline_id) {
              try {
                const validation = await getPipelineResourcesValidation(pipeline.pipeline_id)
                immutable = validation.fields_policy?.immutable ?? []
              } catch {
                // Keep empty immutable
              }
            }
            resourcesStore.hydrateResources(pipeline.pipeline_resources, immutable)
          }
        })
        .finally(() => setInitialized(true))
    } else {
      const defaults = resourcesStore.pipeline_resources ?? getResourceDefaults()
      const values = resourcesToFormValues(defaults)
      setInitialValues(values)
      if (!resourcesStore.pipeline_resources) {
        resourcesStore.setResources(defaults)
      }
      setInitialized(true)
    }
  }, [standalone, pipeline?.pipeline_id])

  const handleSave = async (resources: import('@/src/types/pipeline').PipelineResources) => {
    const currentResources = resourcesStore.pipeline_resources ?? undefined
    const sanitized = sanitizePipelineResourcesForSubmit(
      currentResources,
      resources,
      resourcesStore.fields_policy?.immutable ?? []
    )
    resourcesStore.setResources(sanitized)

    if (standalone && pipeline?.pipeline_id) {
      try {
        await updatePipelineResources(pipeline.pipeline_id, sanitized)
        notify({ variant: 'success', title: 'Resources updated. Changes apply when the pipeline is resumed.' })
        onCompleteStandaloneEditing?.()
      } catch (err: any) {
        notify({ variant: 'error', title: err?.message || 'Failed to update resources' })
        throw err
      }
    } else {
      if (onCompleteStep) {
        onCompleteStep(StepKeys.PIPELINE_RESOURCES)
      } else if (onCompleteStandaloneEditing) {
        onCompleteStandaloneEditing()
      }
    }
  }

  const handleDiscard = () => {
    if (standalone && pipeline?.pipeline_id) {
      getPipelineResources(pipeline.pipeline_id).then((res) => {
        setInitialValues(resourcesToFormValues(res.pipeline_resources))
        resourcesStore.hydrateResources(res.pipeline_resources, res.fields_policy?.immutable ?? [])
      })
    } else {
      const defaults = getResourceDefaults()
      setInitialValues(resourcesToFormValues(defaults))
      resourcesStore.setResources(defaults)
    }
    toggleEditMode?.()
  }

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-[var(--color-foreground-neutral-faded)]">Loading resources...</div>
      </div>
    )
  }

  return (
    <PipelineResourcesFormManager
      initialValues={initialValues}
      pipelineShape={pipelineShape}
      immutablePaths={immutablePaths}
      readOnly={readOnly}
      standalone={standalone}
      onSave={handleSave}
      onDiscard={handleDiscard}
      toggleEditMode={toggleEditMode}
      pipelineActionState={pipelineActionState}
      onClose={onCompleteStandaloneEditing}
    />
  )
}
