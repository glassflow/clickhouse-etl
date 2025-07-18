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
      console.warn('Data is not an object:', data)
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
  port: number
  username: string
  password: string
}

export function generateConnectionId(connection: ClickHouseConnectionId): string {
  return `${connection.type}:${connection.cleanHost}:${connection.port}:${connection.username}:${connection.password}`
}

// Utility function to get runtime environment variables
export const getRuntimeEnv = () => {
  if (typeof window !== 'undefined' && window.__ENV__) {
    return window.__ENV__
  }
  return {}
}
