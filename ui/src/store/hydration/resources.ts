import { useStore } from '../index'
import type { PipelineResources } from '@/src/types/pipeline'
import { getPipelineResources, getPipelineResourcesValidation } from '@/src/api/pipeline-api'

/** Config shape for hydrateResources (full pipeline may include source and join). */
export type HydrateResourcesConfig = {
  pipeline_id?: string
  pipeline_resources?: PipelineResources | null
  fields_policy?: { immutable: string[] }
  source?: { topics?: Array<{ replicas?: number } & Record<string, unknown>> }
  join?: { enabled?: boolean }
}

/**
 * When resources section exists but ingestor replicas are missing, fill them from source.topics[].replicas (backward compatibility).
 * Mutates the cloned resources; does not run if pipeline_resources or ingestor is missing.
 */
function applyTopicReplicasFallback(
  resources: PipelineResources,
  sourceTopics?: Array<{ replicas?: number }>,
  joinEnabled?: boolean,
): void {
  if (!resources.ingestor || !Array.isArray(sourceTopics) || sourceTopics.length === 0) return

  const hasJoin = joinEnabled === true && sourceTopics.length >= 2

  if (hasJoin) {
    if (resources.ingestor.left && resources.ingestor.left.replicas == null && sourceTopics[0]?.replicas != null) {
      resources.ingestor.left = { ...resources.ingestor.left, replicas: sourceTopics[0].replicas }
    }
    if (resources.ingestor.right && resources.ingestor.right.replicas == null && sourceTopics[1]?.replicas != null) {
      resources.ingestor.right = { ...resources.ingestor.right, replicas: sourceTopics[1].replicas }
    }
  } else {
    if (resources.ingestor.base && resources.ingestor.base.replicas == null && sourceTopics[0]?.replicas != null) {
      resources.ingestor.base = { ...resources.ingestor.base, replicas: sourceTopics[0].replicas }
    }
  }
}

/**
 * Hydrates resources store with pipeline_resources and fields_policy.
 * When config has pipeline_id but no fields_policy (GET /pipeline/{id} does not return it),
 * fetches policy via getPipelineResources or getPipelineResourcesValidation.
 * When pipeline_id is missing (e.g. import flow), uses only config.pipeline_resources and does not fetch.
 * When resources exist but ingestor replicas are missing, fills them from source.topics[].replicas for backward compatibility.
 */
export async function hydrateResources(pipelineConfig: HydrateResourcesConfig): Promise<void> {
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

  if (pipeline_resources?.ingestor && pipelineConfig?.source?.topics?.length) {
    const cloned = JSON.parse(JSON.stringify(pipeline_resources)) as PipelineResources
    applyTopicReplicasFallback(
      cloned,
      pipelineConfig.source.topics,
      pipelineConfig.join?.enabled,
    )
    pipeline_resources = cloned
  }

  useStore.getState().resourcesStore.hydrateResources(pipeline_resources, immutable)
}
