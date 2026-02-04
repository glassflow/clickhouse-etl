import { JoinConfigSchema, type JoinConfigType } from '@/src/scheme/join.scheme'

/**
 * Returns true when both streams have streamId, joinKey, joinTimeWindowValue, and joinTimeWindowUnit set.
 * Used for canContinue and "returning to form" checks.
 */
export function isJoinConfigComplete(config: JoinConfigType | null | undefined): boolean {
  if (!config?.streams || config.streams.length !== 2) return false
  return config.streams.every(
    (stream) => !!(stream?.streamId && stream?.joinKey && stream?.joinTimeWindowValue && stream?.joinTimeWindowUnit),
  )
}

/**
 * Validates join form data with JoinConfigSchema and returns flat errors keyed by streams.0.joinKey etc.
 */
export function validateJoinForm(data: unknown): {
  success: boolean
  errors: Record<string, string>
} {
  const result = JoinConfigSchema.safeParse(data)
  if (result.success) {
    return { success: true, errors: {} }
  }
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join('.')
    if (path) {
      errors[path] = issue.message
    }
  }
  return { success: false, errors }
}
