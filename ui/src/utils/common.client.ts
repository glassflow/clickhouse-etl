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
