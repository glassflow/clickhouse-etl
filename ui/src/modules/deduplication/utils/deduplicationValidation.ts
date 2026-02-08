import type { DeduplicationConfig } from '@/src/store/deduplication.store'

/**
 * Returns true when key, window, and unit are set (config is complete for continue).
 */
export function isDeduplicationConfigComplete(config: DeduplicationConfig | undefined): boolean {
  if (!config) return false
  return !!(config.key && config.window && config.unit)
}
