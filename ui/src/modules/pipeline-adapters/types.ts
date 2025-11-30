import { InternalPipelineConfig, Pipeline } from '@/src/types/pipeline'

export interface PipelineAdapter {
  version: string
  /**
   * Converts an external API configuration to the internal UI pipeline configuration
   */
  hydrate(apiConfig: any): InternalPipelineConfig

  /**
   * Converts the internal UI pipeline configuration to an external API configuration
   */
  generate(internalConfig: InternalPipelineConfig): any
}
