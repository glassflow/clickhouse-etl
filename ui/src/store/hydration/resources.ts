import { useStore } from '../index'
import type { PipelineResources } from '@/src/types/pipeline'
import { getPipelineResources, getPipelineResourcesValidation } from '@/src/api/pipeline-api'

/**
 * Hydrates resources store with pipeline_resources and fields_policy.
 * When config has pipeline_id but no fields_policy (GET /pipeline/{id} does not return it),
 * fetches policy via getPipelineResources or getPipelineResourcesValidation.
 */
export async function hydrateResources(
  pipelineConfig: {
    pipeline_id?: string
    pipeline_resources?: PipelineResources
    fields_policy?: { immutable: string[] }
  }
): Promise<void> {
  let pipeline_resources = pipelineConfig?.pipeline_resources ?? null
  let immutable = pipelineConfig?.fields_policy?.immutable ?? []

  const pipelineId = pipelineConfig?.pipeline_id
  const hasPolicy = immutable.length > 0

  if (pipelineId && !hasPolicy) {
    try {
      const res = await getPipelineResources(pipelineId)
      pipeline_resources = res.pipeline_resources ?? pipeline_resources
      immutable = res.fields_policy?.immutable ?? []
    } catch {
      try {
        const validation = await getPipelineResourcesValidation(pipelineId)
        immutable = validation.fields_policy?.immutable ?? []
      } catch {
        // Keep empty immutable on fetch failure
      }
    }
  }

  useStore.getState().resourcesStore.hydrateResources(pipeline_resources, immutable)
}
