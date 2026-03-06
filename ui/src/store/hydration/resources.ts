import { useStore } from '../index'
import type { PipelineResources } from '@/src/types/pipeline'

export function hydrateResources(
  pipelineConfig: { pipeline_resources?: PipelineResources; fields_policy?: { immutable: string[] } }
) {
  const pipeline_resources = pipelineConfig?.pipeline_resources ?? null
  const immutable = pipelineConfig?.fields_policy?.immutable ?? []
  useStore.getState().resourcesStore.hydrateResources(pipeline_resources, immutable)
}
