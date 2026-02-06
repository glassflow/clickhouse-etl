/**
 * Pipeline Import Utilities
 *
 * Handles validation and import of pipeline configuration JSON files.
 * Used by the upload pipeline feature on the create screen.
 */

import type { Pipeline } from '@/src/types/pipeline'

export interface ImportValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  config?: Pipeline
  topicCount: number
  pipelineName: string
}

/**
 * Validates an uploaded pipeline configuration JSON.
 * Checks for required fields, valid structure, and supported topic counts.
 */
export function validatePipelineConfig(json: unknown): ImportValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if input is an object
  if (!json || typeof json !== 'object') {
    return {
      valid: false,
      errors: ['Invalid JSON: expected an object'],
      warnings: [],
      topicCount: 0,
      pipelineName: '',
    }
  }

  const config = json as Record<string, unknown>

  // Check for pipeline name
  const pipelineName = typeof config.name === 'string' ? config.name : ''
  if (!pipelineName) {
    errors.push('Missing required field: name')
  }

  // Check for source configuration
  if (!config.source || typeof config.source !== 'object') {
    errors.push('Missing required field: source')
    return {
      valid: false,
      errors,
      warnings,
      topicCount: 0,
      pipelineName,
    }
  }

  const source = config.source as Record<string, unknown>

  // Check for connection params
  if (!source.connection_params || typeof source.connection_params !== 'object') {
    errors.push('Missing required field: source.connection_params')
  } else {
    const connectionParams = source.connection_params as Record<string, unknown>

    // Validate brokers
    if (!connectionParams.brokers || !Array.isArray(connectionParams.brokers) || connectionParams.brokers.length === 0) {
      errors.push('Missing or empty: source.connection_params.brokers')
    }
  }

  // Check for topics
  if (!source.topics || !Array.isArray(source.topics)) {
    errors.push('Missing required field: source.topics (must be an array)')
    return {
      valid: false,
      errors,
      warnings,
      topicCount: 0,
      pipelineName,
    }
  }

  const topics = source.topics as Array<Record<string, unknown>>
  const topicCount = topics.length

  // Validate topic count (must be 1 or 2)
  if (topicCount === 0) {
    errors.push('At least one topic is required in source.topics')
  } else if (topicCount > 2) {
    errors.push(`Invalid topic count: ${topicCount}. Only 1 or 2 topics are supported`)
  }

  // Validate each topic
  topics.forEach((topic, index) => {
    if (!topic.name || typeof topic.name !== 'string') {
      errors.push(`Missing or invalid topic name at source.topics[${index}]`)
    }
  })

  // Check for sink configuration
  if (!config.sink || typeof config.sink !== 'object') {
    errors.push('Missing required field: sink')
  } else {
    const sink = config.sink as Record<string, unknown>

    if (!sink.host || typeof sink.host !== 'string') {
      errors.push('Missing required field: sink.host')
    }

    if (!sink.database || typeof sink.database !== 'string') {
      errors.push('Missing required field: sink.database')
    }

    if (!sink.table || typeof sink.table !== 'string') {
      errors.push('Missing required field: sink.table')
    }
  }

  // Check for join configuration when 2 topics (warning if missing)
  if (topicCount === 2) {
    if (!config.join || typeof config.join !== 'object') {
      warnings.push('Multi-topic pipeline detected but no join configuration found. You will need to configure join settings.')
    }
  }

  // Optional sections - add warnings if they look incomplete
  if (config.filter && typeof config.filter === 'object') {
    const filter = config.filter as Record<string, unknown>
    if (filter.enabled && !filter.expression) {
      warnings.push('Filter is enabled but has no expression')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config: errors.length === 0 ? (json as Pipeline) : undefined,
    topicCount: topicCount > 0 && topicCount <= 2 ? topicCount : 0,
    pipelineName,
  }
}

/**
 * Parses a JSON string and validates it as a pipeline configuration.
 * Returns validation result with parsed config if valid.
 */
export function parsePipelineConfigJson(jsonString: string): ImportValidationResult {
  try {
    const parsed = JSON.parse(jsonString)
    return validatePipelineConfig(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error'
    return {
      valid: false,
      errors: [`Invalid JSON syntax: ${message}`],
      warnings: [],
      topicCount: 0,
      pipelineName: '',
    }
  }
}

/**
 * Maximum file size for pipeline configuration (1MB)
 */
export const MAX_CONFIG_FILE_SIZE = 1024 * 1024

/**
 * Validates file size before reading
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_CONFIG_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds maximum allowed size (1MB)`,
    }
  }
  return { valid: true }
}

/**
 * Reads a File object and returns its text content
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        resolve(content)
      } else {
        reject(new Error('Failed to read file as text'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

/**
 * Marks all stores as valid after successful hydration.
 * This is needed because hydration populates stores but doesn't always
 * set validation status to 'valid'.
 */
export function markStoresValidAfterImport(store: any, config: Pipeline): void {
  const {
    kafkaStore,
    topicsStore,
    deduplicationStore,
    filterStore,
    transformationStore,
    joinStore,
    clickhouseConnectionStore,
    clickhouseDestinationStore,
  } = store

  // Mark Kafka connection as valid if brokers are present
  if (config.source?.connection_params?.brokers?.length > 0) {
    kafkaStore.markAsValid()
  }

  // Mark topics store as valid if topics are present
  if (config.source?.topics?.length > 0) {
    topicsStore.markAsValid()
  }

  // Mark deduplication as valid (it's always optional, defaults to disabled)
  deduplicationStore.markAsValid()

  // Mark filter as valid if present and enabled, or if disabled
  if (!config.filter?.enabled || config.filter?.expression) {
    filterStore.markAsValid()
  }

  // Mark transformation as valid (optional operation)
  transformationStore.markAsValid()

  // Mark join as valid if 2 topics and join is configured, or if single topic
  const topicCount = config.source?.topics?.length || 0
  if (topicCount < 2 || (config.join?.enabled && config.join?.sources?.length > 0)) {
    joinStore.markAsValid()
  }

  // Mark ClickHouse connection as valid if host and database are present
  if (config.sink?.host && config.sink?.database) {
    clickhouseConnectionStore.markAsValid()
  }

  // Mark ClickHouse destination as valid if table is present
  if (config.sink?.table) {
    clickhouseDestinationStore.markAsValid()
  }
}

/**
 * Computes which steps should be marked as completed based on the imported config.
 * Returns an array of step instance IDs that should be marked as completed.
 *
 * @param config - The imported pipeline configuration
 * @param journey - The journey step instances for the topic count
 * @param getValidationStatus - Function to get validation status for a step key
 */
export function computeInitialCompletedSteps(
  config: Pipeline,
  journey: Array<{ id: string; key: string }>,
  getValidationStatus: (key: string) => 'not-configured' | 'valid' | 'invalidated',
): string[] {
  const completedIds: string[] = []

  // Walk through the journey and mark steps as completed until we hit an invalid one
  for (const step of journey) {
    const status = getValidationStatus(step.key)
    if (status !== 'valid') {
      // Stop at first incomplete step
      break
    }
    completedIds.push(step.id)
  }

  return completedIds
}
