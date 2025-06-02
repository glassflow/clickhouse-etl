// Helper function to infer JSON type
export function inferJsonType(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const type = typeof value

  if (type === 'number') {
    // Check if it's an integer
    if (Number.isInteger(value)) {
      // Determine the integer type based on value range
      if (value >= 0) {
        // Unsigned integers
        if (value <= 255) return 'uint8'
        if (value <= 65535) return 'uint16'
        if (value <= 4294967295) return 'uint32'
        if (value <= Number.MAX_SAFE_INTEGER) return 'uint64'
        return 'string' // For numbers larger than MAX_SAFE_INTEGER, use string
      } else {
        // Signed integers
        if (value >= -128 && value <= 127) return 'int8'
        if (value >= -32768 && value <= 32767) return 'int16'
        if (value >= -2147483648 && value <= 2147483647) return 'int32'
        if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) return 'int64'
        return 'string' // For numbers smaller than MIN_SAFE_INTEGER, use string
      }
    } else {
      // It's a floating point number
      // Use a heuristic to determine if it needs float64 precision
      const absValue = Math.abs(value)
      if (absValue < 3.4e38 && absValue > 1.2e-38) return 'float32'
      return 'float64'
    }
  }

  if (type === 'boolean') return 'bool'

  if (type === 'string') {
    // Try to infer if this string might represent a specific type
    // UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return 'string' // UUID pattern
    }

    // ISO date pattern
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
      return 'string' // Date or DateTime pattern
    }

    return 'string'
  }

  if (Array.isArray(value)) return 'array'

  // For objects, return object type
  return 'object'
}

// Helper function to extract fields from event data
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

/**
 * Maps JSON/Kafka types to compatible ClickHouse types
 */
export const TYPE_COMPATIBILITY_MAP: Record<string, string[]> = {
  // Kafka types
  string: [
    'String',
    'FixedString',
    'DateTime',
    'DateTime64',
    'UUID',
    'Enum8',
    'Enum16',
    'Decimal',
    'Bool',
    'UInt8',
    'UInt16',
    'UInt32',
    'UInt64',
    'UInt128',
    'Date',
    'Date32',
  ],
  int8: ['Int8'],
  int16: ['Int16'],
  int32: ['Int32'],
  int64: ['Int64', 'DateTime', 'DateTime64'],
  float32: ['Float32'],
  float64: ['Float64', 'DateTime', 'DateTime64'],
  bool: ['Bool'],
  bytes: ['String'],

  // Additional JSON types
  int: ['Int8', 'Int16', 'Int32', 'Int64'],
  float: ['Float32', 'Float64'],
  uint8: ['UInt8'],
  uint16: ['UInt16'],
  uint32: ['UInt32'],
  uint64: ['UInt64'],
  uint: ['UInt8', 'UInt16', 'UInt32', 'UInt64'],

  // JavaScript types that might come from inferJsonType
  number: [
    'Int8',
    'Int16',
    'Int32',
    'Int64',
    'UInt8',
    'UInt16',
    'UInt32',
    'UInt64',
    'Float32',
    'Float64',
    'Decimal',
    'DateTime',
    'DateTime64',
  ],
  boolean: ['Bool'],
  object: ['String'], // Objects will be serialized to JSON strings
  array: ['Array', 'String'], // Arrays might be handled specially or serialized to strings
  null: ['Nullable'], // Special case
  undefined: ['Nullable'], // Special case
}

/**
 * Checks if a source type (Kafka/JSON) is compatible with a ClickHouse column type
 * @param sourceType The source data type (Kafka/JSON)
 * @param clickhouseType The ClickHouse column type
 * @returns boolean indicating if the types are compatible
 */
export function isTypeCompatible(sourceType: string | undefined, clickhouseType: string): boolean {
  // If no source type provided, we consider it incompatible
  if (!sourceType) return false

  // Handle Nullable types in ClickHouse
  if (clickhouseType.startsWith('Nullable(')) {
    const innerType = clickhouseType.substring(9, clickhouseType.length - 1)
    return isTypeCompatible(sourceType, innerType)
  }

  // Handle Array types in ClickHouse
  if (clickhouseType.startsWith('Array(')) {
    const innerType = clickhouseType.substring(6, clickhouseType.length - 1)
    return sourceType === 'array' || isTypeCompatible(sourceType, innerType)
  }

  // Check the compatibility map
  const compatibleTypes = TYPE_COMPATIBILITY_MAP[sourceType.toLowerCase()]
  if (!compatibleTypes) return false

  // Check if any compatible type matches (partially) the ClickHouse type
  return compatibleTypes.some((type) => clickhouseType.includes(type))
}

/**
 * Validates column mappings for compatibility between source and destination types
 * @param mappings Array of column mappings to validate
 * @returns An object containing valid and invalid mappings
 */
export function validateColumnMappings(mappings: any[]) {
  const validMappings: any[] = []
  const invalidMappings: any[] = []
  const missingTypeMappings: any[] = []

  mappings.forEach((mapping) => {
    // Skip columns that aren't mapped
    if (!mapping.eventField) return

    // Check for missing jsonType
    if (!mapping.jsonType) {
      missingTypeMappings.push({
        ...mapping,
        reason: `Missing type: Field ${mapping.eventField} is mapped to column ${mapping.name} but has no inferred type`,
      })
      return
    }

    const isValid = isTypeCompatible(mapping.jsonType, mapping.type)
    if (isValid) {
      validMappings.push(mapping)
    } else {
      invalidMappings.push({
        ...mapping,
        reason: `Incompatible type: ${mapping.jsonType} cannot be mapped to ${mapping.type}`,
      })
    }
  })

  return {
    validMappings,
    invalidMappings,
    missingTypeMappings,
  }
}

export const getMappingType = (eventField: string, mapping: any) => {
  const mappingEntry = mapping.find((m: any) => m.eventField === eventField)

  if (mappingEntry) {
    return mappingEntry.jsonType
  }

  // NOTE: default to string if no mapping entry is found - check this
  return 'string'
}
