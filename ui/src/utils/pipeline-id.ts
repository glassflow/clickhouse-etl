import { generateId } from './common.client'
import { structuredLogger } from '@/src/observability'

export interface PipelineIdValidation {
  isValid: boolean
  error?: string
}

export interface PipelineIdGeneration {
  id: string
  name: string
  isValid: boolean
  error?: string
}

/**
 * Validates a pipeline ID against Kubernetes resource name constraints
 */
export const validatePipelineId = (id: string): PipelineIdValidation => {
  // Check length (max 40 characters)
  if (id.length > 40) {
    return {
      isValid: false,
      error: 'Pipeline ID must be 40 characters or less',
    }
  }

  // Check if starts with alphabetic character
  if (!/^[a-z]/.test(id)) {
    return {
      isValid: false,
      error: 'Pipeline ID must start with a letter',
    }
  }

  // Check if ends with alphanumeric character
  if (!/[a-z0-9]$/.test(id)) {
    return {
      isValid: false,
      error: 'Pipeline ID must end with a letter or number',
    }
  }

  // Check if contains only lowercase alphanumeric characters or '-'
  if (!/^[a-z0-9-]+$/.test(id)) {
    return {
      isValid: false,
      error: 'Pipeline ID can only contain lowercase letters, numbers, and hyphens',
    }
  }

  // Check for consecutive hyphens (not allowed in Kubernetes)
  if (id.includes('--')) {
    return {
      isValid: false,
      error: 'Pipeline ID cannot contain consecutive hyphens',
    }
  }

  return { isValid: true }
}

/**
 * Converts a human-readable name to a valid pipeline ID
 */
export const generatePipelineIdFromName = (name: string): string => {
  // Convert to lowercase and replace spaces/special chars with hyphens
  let id = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens

  // Ensure it starts with a letter
  if (!/^[a-z]/.test(id)) {
    id = `pipeline-${id}`
  }

  // Ensure it ends with alphanumeric
  if (!/[a-z0-9]$/.test(id)) {
    id = `${id}-1`
  }

  // Truncate if too long (leaving room for random suffix)
  const maxLength = 30 // Leave 10 chars for random suffix
  if (id.length > maxLength) {
    id = id.substring(0, maxLength)
    // Ensure it still ends with alphanumeric
    if (!/[a-z0-9]$/.test(id)) {
      id = `${id.substring(0, id.length - 1)}1`
    }
  }

  // Add random suffix to ensure uniqueness
  const randomSuffix = generateId().substring(0, 8)
  id = `${id}-${randomSuffix}`

  return id
}

/**
 * Generates a unique pipeline ID that doesn't exist in the backend
 */
export const generateUniquePipelineId = async (
  name: string,
  checkPipelineExists: (id: string) => Promise<boolean>,
): Promise<string> => {
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const id = generatePipelineIdFromName(name)

    try {
      const exists = await checkPipelineExists(id)

      if (!exists) {
        return id
      }
    } catch (error) {
      // In local development, API might not be available
      // Treat network errors as "pipeline doesn't exist" and use the generated ID
      structuredLogger.warn('Pipeline existence check failed, assuming it does not exist for local development', { id, error: error instanceof Error ? error.message : String(error) })
      return id
    }

    attempts++
  }

  // If we can't find a unique ID after max attempts, use UUID
  return `pipeline-${generateId().substring(0, 32)}`
}

/**
 * Validates a pipeline name and generates a corresponding ID
 */
export const validateAndGeneratePipelineId = async (
  name: string,
  checkPipelineExists: (id: string) => Promise<boolean>,
): Promise<PipelineIdGeneration> => {
  // Basic name validation
  if (!name.trim()) {
    return {
      id: '',
      name,
      isValid: false,
      error: 'Pipeline name is required',
    }
  }

  if (name.length < 3) {
    return {
      id: '',
      name,
      isValid: false,
      error: 'Pipeline name must be at least 3 characters long',
    }
  }

  if (name.length > 100) {
    return {
      id: '',
      name,
      isValid: false,
      error: 'Pipeline name must be 100 characters or less',
    }
  }

  try {
    const id = await generateUniquePipelineId(name, checkPipelineExists)
    const validation = validatePipelineId(id)

    return {
      id,
      name,
      isValid: validation.isValid,
      error: validation.error,
    }
  } catch (error) {
    return {
      id: '',
      name,
      isValid: false,
      error: 'Failed to generate pipeline ID',
    }
  }
}
