import { PipelineAdapter } from './types'
import { InternalPipelineConfig, Pipeline } from '@/src/types/pipeline'
import { PipelineVersion } from '@/src/config/pipeline-versions'

export class V1PipelineAdapter implements PipelineAdapter {
  version = PipelineVersion.V1

  hydrate(apiConfig: any): InternalPipelineConfig {
    // V1 API config maps directly to our internal config structure
    // We cast it to ensure type compatibility, but in a real scenario
    // we might want to add validation here
    return apiConfig as InternalPipelineConfig
  }

  generate(internalConfig: InternalPipelineConfig): any {
    // Internal config maps directly to V1 API config
    const config = { ...internalConfig }

    // Ensure version field is set to V1
    config.version = this.version

    return config
  }
}
