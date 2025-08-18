import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simple ID generator for pipeline IDs
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function getEventKeys(data: any): string[] {
  if (!data) return []

  try {
    // If it's a string, try to parse it as JSON
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (e) {
        console.error('Failed to parse string as JSON:', e)
        return []
      }
    }

    // If it's not an object after parsing, return empty array
    if (typeof data !== 'object' || data === null) {
      return []
    }

    // remove _metadata from the event data
    delete data?._metadata

    // Extract keys from the object
    return Object.keys(data)
  } catch (error) {
    console.error('Error in getEventKeys:', error)
    return []
  }
}

export interface ClickHouseConnectionId {
  type: 'direct' | 'client'
  cleanHost: string
  httpPort: number
  username: string
  password: string
}

export function generateConnectionId(connection: ClickHouseConnectionId): string {
  return `${connection.type}:${connection.cleanHost}:${connection.httpPort}:${connection.username}:${connection.password}`
}

// Utility function to get runtime environment variables
export const getRuntimeEnv = () => {
  if (typeof window !== 'undefined' && window.__ENV__) {
    return window.__ENV__
  }
  return {}
}

// Helper function to extract fields from event data with support for nested objects and arrays
export const extractEventFields = (data: any, prefix = ''): string[] => {
  if (!data || typeof data !== 'object') {
    return []
  }

  let fields: string[] = []

  Object.keys(data).forEach((key) => {
    // Skip _metadata and key fields
    if (key.startsWith('_metadata')) {
      return
    }

    const fullPath = prefix ? `${prefix}.${key}` : key
    const value = data[key]

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively extract nested fields
      const nestedFields = extractEventFields(value, fullPath)
      fields = [...fields, ...nestedFields]
    } else if (Array.isArray(value)) {
      // Only add the array field itself for cases where users want the whole array
      fields.push(fullPath)
    } else {
      // Only add leaf fields (fields with primitive values, not objects)
      fields.push(fullPath)
    }
  })

  return fields
}

export const generatePipelineId = (pipelineName: string, existingIds: string[] = []): string => {
  // Convert pipeline name to lowercase and replace spaces/special chars with dashes
  const baseId = pipelineName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single dash

  if (!existingIds.includes(baseId)) {
    return baseId
  }

  // Find existing numbered versions
  const basePattern = new RegExp(`^${baseId}(-\\d+)?$`)
  const numberedVersions = existingIds
    .filter((id) => basePattern.test(id))
    .map((id) => {
      const match = id.match(/-(\d+)$/)
      return match ? parseInt(match[1]) : 0
    })

  // Get the highest number used
  const maxNumber = Math.max(0, ...numberedVersions)

  // Return next available number
  return `${baseId}-${maxNumber + 1}`
}

export function parseForCodeEditor(data: any): string {
  if (!data) return ''

  try {
    // If it's already a string, try to parse it as JSON to validate and then stringify it nicely
    if (typeof data === 'string') {
      // Try to parse it as JSON
      const parsed = JSON.parse(data)

      // Remove _metadata field if it exists
      if (parsed && typeof parsed === 'object' && parsed._metadata) {
        delete parsed._metadata
      }

      return JSON.stringify(parsed, null, 2)
    }

    // If it's an object, remove _metadata field if it exists
    const cleanData = { ...data }
    if (cleanData && typeof cleanData === 'object' && cleanData._metadata) {
      delete cleanData._metadata
    }

    // Stringify the cleaned object
    return JSON.stringify(cleanData, null, 2)
  } catch (error) {
    console.error('Error parsing data for code editor:', error)
    // If parsing fails, return the original data as a string
    return typeof data === 'string' ? data : String(data)
  }
}
