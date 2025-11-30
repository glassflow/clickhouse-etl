import { PipelineAdapter } from './types'
import { V1PipelineAdapter } from './v1'
import { V2PipelineAdapter } from './v2'
import { PipelineVersion } from '@/src/config/pipeline-versions'

const adapters: Record<string, PipelineAdapter> = {
  [PipelineVersion.V1]: new V1PipelineAdapter(),
  [PipelineVersion.V2]: new V2PipelineAdapter(),
}

export const getPipelineAdapter = (version?: string): PipelineAdapter => {
  // Try to find exact match for v1 or v2
  if (version && adapters[version]) {
    return adapters[version]
  }

  // Fallback to V1 for missing version or any other format (e.g., "1.0.0")
  return adapters[PipelineVersion.V1]
}
