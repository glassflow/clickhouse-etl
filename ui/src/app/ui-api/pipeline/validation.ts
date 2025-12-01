import { NextResponse } from 'next/server'

/**
 * Validates a pipeline ID format to prevent invalid characters from reaching the backend.
 * Valid pipeline IDs must:
 * - Be 40 characters or less
 * - Start with a lowercase letter
 * - End with a lowercase letter or number
 * - Contain only lowercase letters, numbers, and hyphens
 * - Not contain consecutive hyphens
 */
export function isValidPipelineId(id: string): { valid: boolean; error?: string } {
  if (id.length > 40) {
    return { valid: false, error: 'Pipeline ID must be 40 characters or less' }
  }

  if (!/^[a-z]/.test(id)) {
    return { valid: false, error: 'Pipeline ID must start with a lowercase letter' }
  }

  if (!/[a-z0-9]$/.test(id)) {
    return { valid: false, error: 'Pipeline ID must end with a lowercase letter or number' }
  }

  if (!/^[a-z0-9-]+$/.test(id)) {
    return { valid: false, error: 'Pipeline ID can only contain lowercase letters, numbers, and hyphens' }
  }

  if (id.includes('--')) {
    return { valid: false, error: 'Pipeline ID cannot contain consecutive hyphens' }
  }

  return { valid: true }
}

/**
 * Validates pipeline ID and returns an error response if invalid.
 * Returns null if the ID is valid.
 */
export function validatePipelineIdOrError(id: string | undefined): NextResponse | null {
  if (!id || id.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: 'Pipeline ID is required',
      },
      { status: 400 },
    )
  }

  const validation = isValidPipelineId(id)
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: validation.error || 'Invalid pipeline ID format',
      },
      { status: 400 },
    )
  }

  return null
}

