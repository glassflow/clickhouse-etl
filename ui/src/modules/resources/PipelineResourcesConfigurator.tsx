'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/src/store'
import { getResourceDefaults } from '@/src/config/resource-defaults'
import { createPipeline, getPipelineResources, getPipelineResourcesValidation, updatePipelineResources } from '@/src/api/pipeline-api'
import { PipelineResourcesFormManager, resourcesToFormValues } from './PipelineResourcesFormManager'
import { sanitizePipelineResourcesForSubmit } from './utils'
import { StepKeys } from '@/src/config/constants'
import { notify } from '@/src/notifications'
import { isPreviewModeEnabled } from '@/src/config/feature-flags'
import { generateApiConfig, getMappingType } from '@/src/modules/clickhouse/utils'
import { structuredLogger } from '@/src/observability'
import { LATEST_PIPELINE_VERSION } from '@/src/config/pipeline-versions'
import { downloadFailedConfig } from '@/src/utils/pipeline-download'
import type { StepBaseProps } from '@/src/modules/pipelines/[id]/step-renderer/stepProps'
import { DestinationErrorBlock } from '@/src/modules/clickhouse/components/DestinationErrorBlock'
import type { DownloadFormat } from '@/src/components/common/DownloadFormatModal'
import { isOtlpSource } from '@/src/config/source-types'

export function PipelineResourcesConfigurator({
  onCompleteStep,
  standalone,
  readOnly = false,
  toggleEditMode,
  onCompleteStandaloneEditing,
  pipeline,
  pipelineActionState,
}: StepBaseProps) {
  const router = useRouter()
  const {
    resourcesStore,
    joinStore,
    topicsStore,
    filterStore,
    transformationStore,
    deduplicationStore,
    coreStore,
    clickhouseConnectionStore,
    clickhouseDestinationStore,
    kafkaStore,
    otlpStore,
  } = useStore()
  const [initialized, setInitialized] = useState(false)
  const [initialValues, setInitialValues] = useState(resourcesToFormValues(null))
  const [deployError, setDeployError] = useState<string | null>(null)
  const [failedDeploymentConfig, setFailedDeploymentConfig] = useState<any>(null)

  const isOtlp = isOtlpSource(coreStore?.sourceType || 'kafka')
  const hasJoin = joinStore?.enabled === true
  const topics = topicsStore?.topics ? Object.values(topicsStore.topics) : []
  const hasTopicDedup = topics.some(
    (t: any, i: number) => deduplicationStore?.getDeduplication?.(i)?.enabled === true
  )
  const hasPipelineDedup = pipeline?.source?.topics?.some((t: any) => t?.deduplication?.enabled === true)
  const hasDedup = hasTopicDedup || hasPipelineDedup
  const hasTransform =
    hasDedup ||
    filterStore?.filterConfig?.enabled === true ||
    transformationStore?.transformationConfig?.enabled === true ||
    (transformationStore?.transformationConfig?.fields?.length ?? 0) > 0

  const pipelineShape = { hasJoin, hasTransform, hasDedup, isOtlp }
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
      // Create flow: either advance to Review step or deploy (when Resources is the last step)
      if (isPreviewModeEnabled()) {
        if (onCompleteStep) {
          onCompleteStep(StepKeys.PIPELINE_RESOURCES)
        } else if (onCompleteStandaloneEditing) {
          onCompleteStandaloneEditing()
        }
      } else {
        // Resources is the last step when preview mode is off – deploy pipeline
        const { pipelineId, setPipelineId, pipelineName, pipelineVersion } = coreStore
        const { clickhouseConnection } = clickhouseConnectionStore
        const { clickhouseDestination } = clickhouseDestinationStore
        const selectedTopics = Object.values(topicsStore.topics || {})

        const payload = generateApiConfig({
          pipelineId,
          pipelineName: pipelineName || 'Pipeline',
          setPipelineId,
          clickhouseConnection,
          clickhouseDestination,
          selectedTopics,
          getMappingType,
          joinStore,
          kafkaStore,
          deduplicationStore,
          filterStore,
          transformationStore,
          pipeline_resources: resourcesStore.pipeline_resources,
          version: pipelineVersion,
          coreStore,
          otlpStore,
        })

        if (payload && typeof payload === 'object' && !('error' in payload)) {
          setDeployError(null)
          setFailedDeploymentConfig(null)
          try {
            const created = await createPipeline(payload as any)
            setPipelineId(created.pipeline_id || (payload as any).pipeline_id || '')
            router.push(`/pipelines/${created.pipeline_id || (payload as any).pipeline_id}?deployment=progress`)
          } catch (err: any) {
            structuredLogger.error('PipelineResourcesConfigurator failed to deploy pipeline', {
              error: err instanceof Error ? err.message : String(err),
            })
            const orphanTable = err?.orphanTable as { database?: string; table?: string; message?: string } | undefined
            const errorMessage = orphanTable
              ? `${err?.message || 'Failed to deploy pipeline'}. ${orphanTable.message || ''} Table: ${orphanTable.database ?? ''}.${orphanTable.table ?? ''}`
              : `Failed to deploy pipeline: ${err?.message}`
            setDeployError(errorMessage)
            setFailedDeploymentConfig(payload)
            notify({ variant: 'error', title: errorMessage })
          }
        } else {
          notify({ variant: 'error', title: 'Invalid pipeline configuration' })
          throw new Error('Invalid pipeline configuration')
        }
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

  const handleDownloadFailedConfig = useCallback(
    (format: DownloadFormat = 'yaml') => {
      if (!failedDeploymentConfig) return
      try {
        const config = {
          ...failedDeploymentConfig,
          name: failedDeploymentConfig.name || coreStore.pipelineName || 'pipeline',
        }
        downloadFailedConfig(config, format, LATEST_PIPELINE_VERSION)
      } catch (downloadError) {
        structuredLogger.error('PipelineResourcesConfigurator failed to download configuration', {
          error: downloadError instanceof Error ? downloadError.message : String(downloadError),
        })
      }
    },
    [failedDeploymentConfig, coreStore.pipelineName],
  )

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-[var(--color-foreground-neutral-faded)]">Loading resources...</div>
      </div>
    )
  }

  return (
    <>
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
      <DestinationErrorBlock
        error={deployError}
        failedDeploymentConfig={failedDeploymentConfig}
        onDownloadConfig={handleDownloadFailedConfig}
      />
    </>
  )
}
