import type { PipelineResources } from '@/src/types/pipeline'

/**
 * Gets a nested value from an object using a slash-separated path (e.g. "nats/stream/maxAge").
 */
function getByPath(obj: Record<string, any>, path: string): unknown {
  const parts = path.split('/')
  let current: any = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return current
}

/**
 * Sets a nested value in an object using a slash-separated path.
 * Creates intermediate objects as needed.
 */
function setByPath(obj: Record<string, any>, path: string, value: unknown): void {
  const parts = path.split('/')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const nextPart = parts[i + 1]
    if (current[part] == null) {
      current[part] = typeof nextPart === 'string' && /^\d+$/.test(nextPart) ? [] : {}
    }
    current = current[part]
  }
  const last = parts[parts.length - 1]
  current[last] = value
}

/**
 * Deep clones an object (simple JSON-compatible clone).
 */
function deepClone<T>(obj: T): T {
  if (obj == null || typeof obj !== 'object') return obj
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Sanitizes pipeline resources for submit by ensuring immutable paths retain
 * their original values from currentResources. Prevents accidental submission
 * of modified immutable values (e.g. from stale state or race conditions).
 *
 * @param currentResources - Original resources (from API or store)
 * @param proposedResources - User-edited resources to submit
 * @param immutablePaths - API-style paths (e.g. "nats/stream/maxAge", "transform/storage/size")
 * @returns Sanitized PipelineResources safe for PUT or POST /edit
 */
export function sanitizePipelineResourcesForSubmit(
  currentResources: PipelineResources | null | undefined,
  proposedResources: PipelineResources,
  immutablePaths: string[]
): PipelineResources {
  if (!currentResources || immutablePaths.length === 0) {
    return proposedResources
  }

  const sanitized = deepClone(proposedResources)

  for (const path of immutablePaths) {
    const value = getByPath(currentResources as Record<string, any>, path)
    if (value !== undefined) {
      setByPath(sanitized as Record<string, any>, path, value)
    }
  }

  return sanitized
}
