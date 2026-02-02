import type { FieldErrors } from 'react-hook-form'

export function getFieldError(errors: FieldErrors | undefined, path: string): string | undefined {
  if (!errors || !path) return undefined
  const parts = path.split('.')
  let current: unknown = errors
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current && typeof current === 'object' && 'message' in current
    ? (current as { message?: string }).message
    : undefined
}
