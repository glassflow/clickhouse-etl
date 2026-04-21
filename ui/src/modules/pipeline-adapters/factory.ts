import { PipelineAdapter } from './types'
import { V1PipelineAdapter } from './v1'
import { V2PipelineAdapter } from './v2'
import { V3PipelineAdapter } from './v3'
import { V3NextPipelineAdapter } from './v3-next'
import { PipelineVersion } from '@/src/config/pipeline-versions'

const adapters: Record<string, PipelineAdapter> = {
  [PipelineVersion.V1]: new V1PipelineAdapter(),
  [PipelineVersion.V2]: new V2PipelineAdapter(),
  [PipelineVersion.V3]: new V3PipelineAdapter(),
  // v3-next: prepared for the upcoming sources[]/transforms[] format; not yet active
  [PipelineVersion.V3_NEXT]: new V3NextPipelineAdapter(),
}

export const getPipelineAdapter = (version?: string, config?: any): PipelineAdapter => {
  const normalized = version === '3' ? PipelineVersion.V3 : version

  // v3 configs from the backend may use the old schema (source object) or the new schema
  // (sources array). Detect by content so old configs hydrate correctly.
  if (normalized === PipelineVersion.V3 && config && Array.isArray(config.sources)) {
    return adapters[PipelineVersion.V3_NEXT]
  }

  if (normalized && adapters[normalized]) {
    return adapters[normalized]
  }

  // Fallback to V1 for missing version or any other format (e.g., "1.0.0")
  return adapters[PipelineVersion.V1]
}
