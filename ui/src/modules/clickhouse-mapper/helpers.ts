// Helper function to infer JSON type
export const inferJsonType = (value: any): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return ''
}

// Helper function to extract fields from event data
export const extractEventFields = (data: any, prefix = ''): string[] => {
  if (!data || typeof data !== 'object') {
    console.log('Data is not an object, returning empty array')
    return []
  }

  let fields: string[] = []
  Object.keys(data).forEach((key) => {
    // Skip _metadata and key fields
    if (key.startsWith('_metadata') || key === 'key') {
      return
    }

    const fullPath = prefix ? `${prefix}.${key}` : key
    fields.push(fullPath)

    // Recursively extract nested fields
    if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
      fields = [...fields, ...extractEventFields(data[key], fullPath)]
    }
  })

  return fields
}

// Helper function to find best matching field
export const findBestMatchingField = (columnName: string, fields: string[]): string | undefined => {
  const normalizedColumnName = columnName.toLowerCase().replace(/[^a-z0-9]/g, '')

  // First try exact match
  const exactMatch = fields.find((field) => {
    const fieldParts = field.split('.')
    const lastPart = fieldParts[fieldParts.length - 1]
    return lastPart.toLowerCase() === normalizedColumnName
  })

  if (exactMatch) return exactMatch

  // Then try contains match
  const containsMatch = fields.find((field) => {
    const fieldParts = field.split('.')
    const lastPart = fieldParts[fieldParts.length - 1]
    return (
      lastPart.toLowerCase().includes(normalizedColumnName) || normalizedColumnName.includes(lastPart.toLowerCase())
    )
  })

  return containsMatch
}

// Helper function to get nested value from an object using dot notation
export const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined

  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = current[part]
  }

  return current
}
