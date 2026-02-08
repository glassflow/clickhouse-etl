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

// Helper function to check if analytics is enabled based on environment variable
export const isAnalyticsEnabled = (): boolean => {
  const isServer = typeof window === 'undefined'

  if (isServer) {
    // For server-side, use process.env directly
    return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
  } else {
    // For client-side, check runtime environment first (for Docker builds)
    const runtimeEnv = getRuntimeEnv()
    if (runtimeEnv.NEXT_PUBLIC_ANALYTICS_ENABLED !== undefined) {
      return runtimeEnv.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
    }

    // Fallback to process.env
    return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
  }
}

// Helper function to check if demo mode is enabled based on environment variable
export const isDemoMode = (): boolean => {
  const isServer = typeof window === 'undefined'

  if (isServer) {
    // For server-side, use process.env directly
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  } else {
    // For client-side, check runtime environment first (for Docker builds)
    const runtimeEnv = getRuntimeEnv() as any
    if (runtimeEnv.NEXT_PUBLIC_DEMO_MODE !== undefined) {
      return runtimeEnv.NEXT_PUBLIC_DEMO_MODE === 'true'
    }

    // Fallback to process.env
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  }
}

/**
 * Get the Grafana/metrics dashboard URL from environment variables.
 * Handles both server-side and client-side rendering, including Docker runtime environments.
 *
 * @returns The dashboard URL or null if not configured
 */
export const getDashboardUrl = (): string | null => {
  const isServer = typeof window === 'undefined'

  if (isServer) {
    return process.env.NEXT_PUBLIC_DASHBOARD || null
  } else {
    const runtimeEnv = getRuntimeEnv() as any
    return runtimeEnv.NEXT_PUBLIC_DASHBOARD || process.env.NEXT_PUBLIC_DASHBOARD || null
  }
}

/**
 * Check if the Grafana/metrics dashboard is available.
 * The dashboard is considered available when:
 * - The NEXT_PUBLIC_DASHBOARD environment variable is set
 * - The application is running in demo mode
 *
 * @returns true if the dashboard is available and should be shown
 */
export const isDashboardAvailable = (): boolean => {
  const dashboardUrl = getDashboardUrl()
  return !!(dashboardUrl && isDemoMode())
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

/**
 * Compare two event schemas to determine if they have the same structure
 * Returns true if schemas match, false if they differ
 * This is used to determine if changing the event (e.g., offset change) should invalidate dependent sections
 */
export const compareEventSchemas = (oldEvent: any, newEvent: any): boolean => {
  if (!oldEvent && !newEvent) return true
  if (!oldEvent || !newEvent) return false

  try {
    // Remove _metadata from both events before comparison
    const cleanOldEvent = { ...oldEvent }
    const cleanNewEvent = { ...newEvent }
    delete cleanOldEvent?._metadata
    delete cleanNewEvent?._metadata

    // Extract field paths from both events
    const oldFields = extractEventFields(cleanOldEvent).sort()
    const newFields = extractEventFields(cleanNewEvent).sort()

    // If field counts differ, schemas are different
    if (oldFields.length !== newFields.length) {
      return false
    }

    // Check if all field paths are the same
    for (let i = 0; i < oldFields.length; i++) {
      if (oldFields[i] !== newFields[i]) {
        return false
      }
    }

    // Field paths are identical, schemas match!
    return true
  } catch (error) {
    console.error('[Schema Comparison] Error comparing schemas:', error)
    // On error, assume schemas differ to be safe
    return false
  }
}

/**
 * Schema field type used in KafkaTypeVerification
 */
export interface SchemaField {
  name: string
  type: string
  inferredType?: string
  userType?: string
  isManuallyAdded?: boolean
  isRemoved?: boolean
}

/**
 * Get a type-appropriate placeholder value for a field type
 */
const getPlaceholderForType = (type: string): any => {
  switch (type.toLowerCase()) {
    case 'string':
      return '<added_field>'
    case 'number':
    case 'integer':
    case 'float':
    case 'double':
      return 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      return {}
    case 'date':
    case 'datetime':
      return '<date>'
    default:
      return '<added_field>'
  }
}

/**
 * Delete a nested field from an object using dot notation path
 * e.g., deleteNestedField(obj, 'user.address.city') will delete obj.user.address.city
 */
const deleteNestedField = (obj: Record<string, any>, path: string): void => {
  const parts = path.split('.')
  let current = obj

  // Navigate to the parent of the field to delete
  for (let i = 0; i < parts.length - 1; i++) {
    if (current && typeof current === 'object' && parts[i] in current) {
      current = current[parts[i]]
    } else {
      // Path doesn't exist, nothing to delete
      return
    }
  }

  // Delete the final field
  if (current && typeof current === 'object') {
    delete current[parts[parts.length - 1]]
  }
}

/**
 * Set a nested field in an object using dot notation path
 * e.g., setNestedField(obj, 'user.address.city', 'NYC') will set obj.user.address.city = 'NYC'
 * Creates intermediate objects if they don't exist
 */
const setNestedField = (obj: Record<string, any>, path: string, value: any): void => {
  const parts = path.split('.')
  let current = obj

  // Navigate/create path to the parent of the field to set
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {}
    }
    current = current[parts[i]]
  }

  // Set the final field
  current[parts[parts.length - 1]] = value
}

/**
 * Deep clone an object to avoid mutating the original
 */
const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Build an effective event object that reflects schema modifications from KafkaTypeVerification.
 * This creates a "virtual" event that:
 * - Removes fields marked as isRemoved
 * - Adds placeholder values for fields marked as isManuallyAdded
 *
 * @param originalEvent - The original Kafka event data
 * @param schemaFields - The schema fields from topic.schema.fields (from KafkaTypeVerification)
 * @returns A new event object with modifications applied
 */
export const buildEffectiveEvent = (
  originalEvent: Record<string, any> | null,
  schemaFields: SchemaField[] | undefined,
): Record<string, any> | null => {
  if (!originalEvent) {
    return null
  }

  // If no schema fields, return the original event as-is
  if (!schemaFields || schemaFields.length === 0) {
    return originalEvent
  }

  // Deep clone to avoid mutating the original
  const effectiveEvent = deepClone(originalEvent)

  // Remove _metadata if present
  delete effectiveEvent._metadata

  // Remove fields marked as removed
  schemaFields
    .filter((f) => f.isRemoved)
    .forEach((f) => {
      deleteNestedField(effectiveEvent, f.name)
    })

  // Add manually added fields with placeholder values
  schemaFields
    .filter((f) => f.isManuallyAdded && !f.isRemoved)
    .forEach((f) => {
      const placeholder = getPlaceholderForType(f.userType || f.type || 'string')
      setNestedField(effectiveEvent, f.name, placeholder)
    })

  return effectiveEvent
}

/**
 * Get the list of effective field names from schema fields.
 * This returns only the active (non-removed) fields.
 *
 * @param schemaFields - The schema fields from topic.schema.fields
 * @returns Array of field names that are active (not removed)
 */
export const getEffectiveFieldNames = (schemaFields: SchemaField[] | undefined): string[] => {
  if (!schemaFields || schemaFields.length === 0) {
    return []
  }

  return schemaFields.filter((f) => !f.isRemoved).map((f) => f.name)
}

/**
 * Check if the schema has any modifications (added or removed fields)
 *
 * @param schemaFields - The schema fields from topic.schema.fields
 * @returns Object indicating if there are added or removed fields
 */
export const getSchemaModifications = (
  schemaFields: SchemaField[] | undefined,
): { hasAddedFields: boolean; hasRemovedFields: boolean; addedCount: number; removedCount: number } => {
  if (!schemaFields || schemaFields.length === 0) {
    return { hasAddedFields: false, hasRemovedFields: false, addedCount: 0, removedCount: 0 }
  }

  const addedFields = schemaFields.filter((f) => f.isManuallyAdded && !f.isRemoved)
  const removedFields = schemaFields.filter((f) => f.isRemoved)

  return {
    hasAddedFields: addedFields.length > 0,
    hasRemovedFields: removedFields.length > 0,
    addedCount: addedFields.length,
    removedCount: removedFields.length,
  }
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

// Helper function to format numbers with appropriate units
export const formatNumber = (num: number): string => {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
  return num.toString()
}

// Helper function to format bytes
export const formatBytes = (bytes: number): string => {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)}TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)}KB`
  return `${bytes}B`
}

// Helper function to format relative time with live seconds for recent updates
export const formatRelativeTime = (timestamp: string | null, currentTime?: Date): string => {
  if (!timestamp || timestamp === '' || timestamp === '0') return '-'

  const now = currentTime || new Date()
  const eventTime = new Date(timestamp)

  if (isNaN(eventTime.getTime()) || eventTime.getFullYear() < 2000) {
    return '-'
  }

  const diffMs = now.getTime() - eventTime.getTime()
  if (diffMs < 0) return '-'

  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)

  // Show live seconds for updates within the last minute
  if (diffSeconds < 5) return 'Just now'
  if (diffSeconds < 60) return `${diffSeconds} sec. ago`
  if (diffMinutes < 60) return `${diffMinutes} min. ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays > 365) return 'Over a year ago'

  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

// Helper function to format creation date with intelligent display
export const formatCreatedAt = (timestamp: string | null): string => {
  if (!timestamp || timestamp === '' || timestamp === '0') return '-'

  const now = new Date()
  const createdTime = new Date(timestamp)

  if (isNaN(createdTime.getTime()) || createdTime.getFullYear() < 2000) {
    return '-'
  }

  const diffMs = now.getTime() - createdTime.getTime()
  if (diffMs < 0) return '-'

  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)

  // Less than 1 hour: show relative time
  if (diffSeconds < 5) return 'Just now'
  if (diffSeconds < 60) return `${diffSeconds} sec. ago`
  if (diffMinutes < 60) return `${diffMinutes} min. ago`

  // Format time as HH:MM AM/PM
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Check if it's today
  const isToday =
    now.getDate() === createdTime.getDate() &&
    now.getMonth() === createdTime.getMonth() &&
    now.getFullYear() === createdTime.getFullYear()

  if (isToday) {
    return `Today, ${formatTime(createdTime)}`
  }

  // Check if it's yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    yesterday.getDate() === createdTime.getDate() &&
    yesterday.getMonth() === createdTime.getMonth() &&
    yesterday.getFullYear() === createdTime.getFullYear()

  if (isYesterday) {
    return `Yesterday, ${formatTime(createdTime)}`
  }

  // More than 1 day ago: show date and time
  const month = createdTime.toLocaleString('en-US', { month: 'short' })
  const day = createdTime.getDate()
  const year = createdTime.getFullYear()
  const currentYear = now.getFullYear()
  const time = formatTime(createdTime)

  // Include year if different from current year
  if (year !== currentYear) {
    return `${month} ${day}, ${year}, ${time}`
  }

  return `${month} ${day}, ${time}`
}
