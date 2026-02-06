import { detectTransformationType } from '@/src/types/pipeline'

interface DeduplicationConfig {
  enabled?: boolean
  key?: string
}

interface TopicDeduplicationConfig {
  enabled?: boolean
  id_field?: string
}

interface Topic {
  deduplication?: TopicDeduplicationConfig
}

/**
 * Check if deduplication is configured and has a valid key
 */
export function isDeduplicationEnabled(
  dedupConfig: DeduplicationConfig | undefined | null,
  topic: Topic | undefined | null,
): boolean {
  const enabled = dedupConfig?.enabled === true || topic?.deduplication?.enabled === true
  const key = (dedupConfig?.key || topic?.deduplication?.id_field || '').trim()
  return enabled && key.length > 0
}

/**
 * Derive transformation type label based on join and deduplication configuration
 * @param joinEnabled - Whether join is enabled
 * @param leftDedup - Whether left topic has deduplication
 * @param rightDedup - Whether right topic has deduplication
 * @param pipeline - Pipeline config for fallback detection
 */
export function getTransformationTypeLabel(
  joinEnabled: boolean,
  leftDedup: boolean,
  rightDedup: boolean,
  pipeline: any,
): string {
  if (joinEnabled && leftDedup && rightDedup) {
    return 'Join & Deduplication'
  }
  if (joinEnabled) {
    return 'Join'
  }
  // Fallback to raw pipeline detection for single topic cases
  return detectTransformationType(pipeline)
}
