import { PipelineAdapter } from './types'
import { V1PipelineAdapter } from './v1'
import { PipelineVersion, LATEST_PIPELINE_VERSION } from '@/src/config/pipeline-versions'

const adapters: Record<string, PipelineAdapter> = {
  [PipelineVersion.V1]: new V1PipelineAdapter(),
}

export const getPipelineAdapter = (version?: string): PipelineAdapter => {
  // Default to V1 if version is missing (legacy support)
  const targetVersion = version || PipelineVersion.V1

  const adapter = adapters[targetVersion]

  if (!adapter) {
    console.warn(`No adapter found for version ${version}, falling back to latest (${LATEST_PIPELINE_VERSION})`)
    return adapters[LATEST_PIPELINE_VERSION]
  }

  return adapter
}
