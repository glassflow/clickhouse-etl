import { PipelineAdapter } from './types'
import { V1PipelineAdapter } from './v1'
import { V2PipelineAdapter } from './v2'
import { V3PipelineAdapter } from './v3'
import { PipelineVersion } from '@/src/config/pipeline-versions'

const adapters: Record<string, PipelineAdapter> = {
  [PipelineVersion.V1]: new V1PipelineAdapter(),
  [PipelineVersion.V2]: new V2PipelineAdapter(),
  [PipelineVersion.V3]: new V3PipelineAdapter(),
}

export const getPipelineAdapter = (version?: string): PipelineAdapter => {
  const normalized = version === '3' ? PipelineVersion.V3 : version

  if (normalized && adapters[normalized]) {
    return adapters[normalized]
  }

  // Fallback to V1 for missing version or any other format (e.g., "1.0.0")
  return adapters[PipelineVersion.V1]
}
