import { InternalPipelineConfig, PipelineApiResponse } from '@/src/types/pipeline'

/**
 * Pipeline adapter interface for converting between API and internal formats.
 *
 * Each adapter handles a specific API version and provides bidirectional
 * conversion between the raw API response and the normalized internal config.
 */
export interface PipelineAdapter {
  /** The API version this adapter handles (e.g., "1.0", "2.0") */
  version: string

  /**
   * Converts an external API configuration to the internal UI pipeline configuration.
   *
   * @param apiConfig - Raw response from the backend API
   * @returns Normalized InternalPipelineConfig for use in UI stores
   *
   * @example
   * const apiResponse = await getPipeline(id) // PipelineApiResponse
   * const adapter = getPipelineAdapter(apiResponse.version)
   * const internalConfig = adapter.hydrate(apiResponse) // InternalPipelineConfig
   * enterViewMode(internalConfig)
   */
  hydrate(apiConfig: PipelineApiResponse): InternalPipelineConfig

  /**
   * Converts the internal UI pipeline configuration to an external API configuration.
   *
   * @param internalConfig - Normalized config from UI stores
   * @returns API-formatted config for sending to backend
   */
  generate(internalConfig: InternalPipelineConfig): PipelineApiResponse
}
