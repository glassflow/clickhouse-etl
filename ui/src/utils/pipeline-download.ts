import { Pipeline, ListPipelineConfig } from '@/src/types/pipeline'
import { getPipeline } from '@/src/api/pipeline-api'
import { getPipelineAdapter } from '@/src/modules/pipeline-adapters/factory'
import { structuredLogger } from '@/src/observability'
import { PipelineVersion, LATEST_PIPELINE_VERSION } from '@/src/config/pipeline-versions'
import yaml from 'js-yaml'

/**
 * Pipeline Download Utility
 *
 * This utility provides functions to download pipeline configurations in various formats.
 * It handles both full Pipeline objects and ListPipelineConfig objects by fetching
 * the complete configuration when needed.
 *
 * The utility uses the adapter system to ensure downloaded configs match the correct version format.
 *
 * Usage examples:
 *
 * // Download as JSON (default)
 * await downloadPipelineConfig(pipeline)
 *
 * // Download as YAML
 * await downloadPipelineConfigAsYaml(pipeline)
 *
 * // Download with custom filename
 * await downloadPipelineConfig(pipeline, 'my-custom-config.json')
 *
 * // Download in specific format
 * await downloadPipelineConfigInFormat(pipeline, 'yaml', 'config.yaml')
 */

/**
 * Downloads pipeline configuration as a JSON file
 * Uses the adapter system to ensure the config is in the correct version format
 * @param pipeline - Pipeline configuration to download
 * @param filename - Optional custom filename (defaults to pipeline name)
 */
export const downloadPipelineConfig = async (
  pipeline: Pipeline | ListPipelineConfig,
  filename?: string,
): Promise<void> => {
  try {
    let rawConfig: any

    // If we have a full Pipeline object, use it directly
    if ('source' in pipeline && 'sink' in pipeline) {
      rawConfig = pipeline
    } else {
      // If we have a ListPipelineConfig, fetch the full configuration
      rawConfig = await getPipeline(pipeline.pipeline_id)
    }

    // Use the adapter system to get the correct format
    // 1. Hydrate using content-aware adapter detection (sources[] → v3-next schema)
    const sourceVersion = rawConfig.version || PipelineVersion.V1
    const sourceAdapter = getPipelineAdapter(sourceVersion)
    const internalConfig = sourceAdapter.hydrate(rawConfig)

    // 2. Always export in the latest format so downloaded configs match the backend API
    const targetAdapter = getPipelineAdapter(LATEST_PIPELINE_VERSION)
    const exportConfig = targetAdapter.generate(internalConfig)

    // Safely remove status field (it's runtime state, not configuration)
    // Using destructuring with rest to safely exclude even if field doesn't exist
    const { status: _status, ...configWithoutStatus } = exportConfig || {}

    // Add export metadata
    const downloadConfig = {
      ...configWithoutStatus,
      exported_at: new Date().toISOString(),
      exported_by: 'GlassFlow UI',
    }

    // Generate filename with timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const sanitizedName = (rawConfig.name || 'pipeline').replace(/[^a-zA-Z0-9-_]/g, '_')
    const defaultFilename = `${sanitizedName}_config_${timestamp}.json`
    const finalFilename = filename || defaultFilename

    triggerDownload(new Blob([JSON.stringify(downloadConfig, null, 2)], { type: 'application/json' }), finalFilename)
  } catch (error) {
    structuredLogger.error('Failed to download pipeline configuration', { error: error instanceof Error ? error.message : String(error) })
    throw new Error('Failed to download pipeline configuration. Please try again.')
  }
}

/**
 * Downloads pipeline configuration as a YAML file
 * Uses the adapter system to ensure the config is in the correct version format
 * @param pipeline - Pipeline configuration to download
 * @param filename - Optional custom filename (defaults to pipeline name)
 */
export const downloadPipelineConfigAsYaml = async (
  pipeline: Pipeline | ListPipelineConfig,
  filename?: string,
): Promise<void> => {
  try {
    let rawConfig: any

    if ('source' in pipeline && 'sink' in pipeline) {
      rawConfig = pipeline
    } else {
      rawConfig = await getPipeline(pipeline.pipeline_id)
    }

    const sourceVersion = rawConfig.version || PipelineVersion.V1
    const sourceAdapter = getPipelineAdapter(sourceVersion)
    const internalConfig = sourceAdapter.hydrate(rawConfig)

    const targetAdapter = getPipelineAdapter(LATEST_PIPELINE_VERSION)
    const exportConfig = targetAdapter.generate(internalConfig)

    const { status: _status, ...configWithoutStatus } = exportConfig || {}

    const downloadConfig = {
      ...configWithoutStatus,
      exported_at: new Date().toISOString(),
      exported_by: 'GlassFlow UI',
    }

    const yamlContent = yaml.dump(downloadConfig, { indent: 2, lineWidth: -1, noRefs: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const sanitizedName = (rawConfig.name || 'pipeline').replace(/[^a-zA-Z0-9-_]/g, '_')
    const defaultFilename = `${sanitizedName}_config_${timestamp}.yaml`
    const finalFilename = filename || defaultFilename

    triggerDownload(new Blob([yamlContent], { type: 'text/yaml' }), finalFilename)
  } catch (error) {
    structuredLogger.error('Failed to download pipeline configuration as YAML', { error: error instanceof Error ? error.message : String(error) })
    throw new Error('Failed to download pipeline configuration as YAML. Please try again.')
  }
}

/**
 * Downloads pipeline configuration in a specific format.
 * Defaults to YAML.
 */
export const downloadPipelineConfigInFormat = async (
  pipeline: Pipeline | ListPipelineConfig,
  format: 'json' | 'yaml' = 'yaml',
  filename?: string,
): Promise<void> => {
  if (format === 'yaml') {
    await downloadPipelineConfigAsYaml(pipeline, filename)
  } else {
    await downloadPipelineConfig(pipeline, filename)
  }
}

/**
 * Downloads a raw config object (e.g. from a failed deployment) in the chosen format.
 * Adds export metadata and a timestamp-based filename automatically.
 */
export const downloadFailedConfig = (config: any, format: 'json' | 'yaml' = 'yaml', version?: string): void => {
  const downloadConfig = {
    ...config,
    exported_at: new Date().toISOString(),
    exported_by: 'GlassFlow UI',
    ...(version ? { version } : {}),
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const sanitizedName = ((config?.name as string) || 'pipeline').replace(/[^a-zA-Z0-9-_]/g, '_')

  if (format === 'yaml') {
    const yamlContent = yaml.dump(downloadConfig, { indent: 2, lineWidth: -1, noRefs: true })
    triggerDownload(new Blob([yamlContent], { type: 'text/yaml' }), `${sanitizedName}_config_${timestamp}.yaml`)
  } else {
    triggerDownload(
      new Blob([JSON.stringify(downloadConfig, null, 2)], { type: 'application/json' }),
      `${sanitizedName}_config_${timestamp}.json`,
    )
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
