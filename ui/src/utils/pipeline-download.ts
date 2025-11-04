import { Pipeline, ListPipelineConfig } from '@/src/types/pipeline'
import { getPipeline } from '@/src/api/pipeline-api'

/**
 * Pipeline Download Utility
 *
 * This utility provides functions to download pipeline configurations in various formats.
 * It handles both full Pipeline objects and ListPipelineConfig objects by fetching
 * the complete configuration when needed.
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
 * @param pipeline - Pipeline configuration to download
 * @param filename - Optional custom filename (defaults to pipeline name)
 */
export const downloadPipelineConfig = async (
  pipeline: Pipeline | ListPipelineConfig,
  filename?: string,
): Promise<void> => {
  try {
    let configToDownload: Pipeline

    // If we have a full Pipeline object, use it directly
    if ('source' in pipeline && 'sink' in pipeline) {
      configToDownload = pipeline as Pipeline
    } else {
      // If we have a ListPipelineConfig, fetch the full configuration
      configToDownload = await getPipeline(pipeline.pipeline_id)
    }

    // Create a clean configuration object for download
    const downloadConfig = {
      pipeline_id: configToDownload.pipeline_id,
      name: configToDownload.name,
      created_at: configToDownload.created_at,
      source: configToDownload.source,
      join: configToDownload.join,
      sink: configToDownload.sink,
      // Add metadata
      exported_at: new Date().toISOString(),
      exported_by: 'GlassFlow UI',
      version: '1.0.0',
    }

    // Generate filename with timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const sanitizedName = configToDownload.name.replace(/[^a-zA-Z0-9-_]/g, '_')
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
 * @param pipeline - Pipeline configuration to download
 * @param filename - Optional custom filename (defaults to pipeline name)
 */
export const downloadPipelineConfigAsYaml = async (
  pipeline: Pipeline | ListPipelineConfig,
  filename?: string,
): Promise<void> => {
  try {
    let configToDownload: Pipeline

    // If we have a full Pipeline object, use it directly
    if ('source' in pipeline && 'sink' in pipeline) {
      configToDownload = pipeline as Pipeline
    } else {
      // If we have a ListPipelineConfig, fetch the full configuration
      configToDownload = await getPipeline(pipeline.pipeline_id)
    }

    // Convert to YAML format (simplified conversion)
    const yamlConfig = convertToYaml(configToDownload)

    // Generate filename with timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const sanitizedName = configToDownload.name.replace(/[^a-zA-Z0-9-_]/g, '_')
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
function convertToYaml(pipeline: Pipeline): string {
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

  const config = {
    pipeline_id: pipeline.pipeline_id,
    name: pipeline.name,
    created_at: pipeline.created_at,
    source: pipeline.source,
    join: pipeline.join,
    sink: pipeline.sink,
    metadata: {
      exported_at: new Date().toISOString(),
      exported_by: 'GlassFlow UI',
      version: '1.0.0',
    },
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
