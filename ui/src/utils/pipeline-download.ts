import { Pipeline, ListPipelineConfig } from '@/src/types/pipeline'
import { getPipeline } from '@/src/api/pipeline-api'
import { getPipelineAdapter } from '@/src/modules/pipeline-adapters/factory'
import { PipelineVersion } from '@/src/config/pipeline-versions'

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
    // 1. Hydrate to internal config using the source version adapter
    const sourceVersion = rawConfig.version || PipelineVersion.V1
    const sourceAdapter = getPipelineAdapter(sourceVersion)
    const internalConfig = sourceAdapter.hydrate(rawConfig)

    // 2. Generate the export config using the same version (preserve original format)
    const targetAdapter = getPipelineAdapter(sourceVersion)
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

    // Create and download the file
    const blob = new Blob([JSON.stringify(downloadConfig, null, 2)], {
      type: 'application/json',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = finalFilename
    link.style.display = 'none' // Hide the link element
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to download pipeline configuration:', error)
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

    // If we have a full Pipeline object, use it directly
    if ('source' in pipeline && 'sink' in pipeline) {
      rawConfig = pipeline
    } else {
      // If we have a ListPipelineConfig, fetch the full configuration
      rawConfig = await getPipeline(pipeline.pipeline_id)
    }

    // Use the adapter system to get the correct format
    // 1. Hydrate to internal config using the source version adapter
    const sourceVersion = rawConfig.version || PipelineVersion.V1
    const sourceAdapter = getPipelineAdapter(sourceVersion)
    const internalConfig = sourceAdapter.hydrate(rawConfig)

    // 2. Generate the export config using the same version (preserve original format)
    const targetAdapter = getPipelineAdapter(sourceVersion)
    const exportConfig = targetAdapter.generate(internalConfig)

    // Safely remove status field (it's runtime state, not configuration)
    // Using destructuring with rest to safely exclude even if field doesn't exist
    const { status: _status, ...configWithoutStatus } = exportConfig || {}

    // Add export metadata
    const configWithMetadata = {
      ...configWithoutStatus,
      metadata: {
        exported_at: new Date().toISOString(),
        exported_by: 'GlassFlow UI',
      },
    }

    // Convert to YAML format
    const yamlConfig = convertToYaml(configWithMetadata)

    // Generate filename with timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const sanitizedName = (rawConfig.name || 'pipeline').replace(/[^a-zA-Z0-9-_]/g, '_')
    const defaultFilename = `${sanitizedName}_config_${timestamp}.yaml`
    const finalFilename = filename || defaultFilename

    // Create and download the file
    const blob = new Blob([yamlConfig], {
      type: 'text/yaml',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = finalFilename
    link.style.display = 'none' // Hide the link element
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to download pipeline configuration as YAML:', error)
    throw new Error('Failed to download pipeline configuration as YAML. Please try again.')
  }
}

/**
 * Simple JSON to YAML converter for pipeline configuration
 * This is a basic implementation - for production use, consider using a proper YAML library
 */
function convertToYaml(config: any): string {
  const indent = (level: number) => '  '.repeat(level)

  const convertValue = (value: any, level: number = 0): string => {
    if (value === null || value === undefined) {
      return 'null'
    }

    if (typeof value === 'string') {
      return `"${value}"`
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]'
      }
      return value.map((item) => `${indent(level + 1)}- ${convertValue(item, level + 1)}`).join('\n')
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value)
      if (entries.length === 0) {
        return '{}'
      }
      return entries
        .map(([key, val]) => {
          const convertedVal = convertValue(val, level + 1)
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            return `${indent(level)}${key}:\n${convertedVal}`
          }
          return `${indent(level)}${key}: ${convertedVal}`
        })
        .join('\n')
    }

    return String(value)
  }

  return convertValue(config, 0)
}

/**
 * Downloads pipeline configuration in a specific format
 * @param pipeline - Pipeline configuration to download
 * @param format - Download format ('json' or 'yaml')
 * @param filename - Optional custom filename
 */
export const downloadPipelineConfigInFormat = async (
  pipeline: Pipeline | ListPipelineConfig,
  format: 'json' | 'yaml' = 'json',
  filename?: string,
): Promise<void> => {
  if (format === 'yaml') {
    await downloadPipelineConfigAsYaml(pipeline, filename)
  } else {
    await downloadPipelineConfig(pipeline, filename)
  }
}
