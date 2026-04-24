import type { InternalFieldType } from '@/src/types/schema'

/**
 * Infers an InternalFieldType from a runtime JavaScript value.
 * Returns 'string' for null/undefined/unknown shapes.
 */
export function valueToFieldType(value: unknown): InternalFieldType {
  if (value === null || value === undefined) return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return 'string'
}

/**
 * Maps an InternalFieldType to its default ClickHouse column type.
 */
export function jsonTypeToClickHouseType(t: InternalFieldType): string {
  switch (t) {
    case 'string':    return 'String'
    case 'number':    return 'Float64'
    case 'boolean':   return 'UInt8'
    case 'timestamp': return 'DateTime64(3)'
    case 'object':    return 'String'
    case 'array':     return 'String'
  }
}

/**
 * Maps a ClickHouse type string back to an InternalFieldType.
 * Returns 'string' for unknown types.
 */
export function clickHouseTypeToJsonType(t: string): InternalFieldType {
  const lower = (t ?? '').toLowerCase()
    .replace(/nullable\((.*)\)/, '$1')
    .replace(/lowcardinality\((.*)\)/, '$1')
    .trim()

  // UInt8 is the canonical ClickHouse boolean type — check before general uint/u prefix
  if (lower === 'uint8' || lower === 'bool' || lower === 'boolean') return 'boolean'
  if (lower.startsWith('float') || lower.startsWith('decimal')) return 'number'
  if (lower.startsWith('int') || lower.startsWith('uint') || lower.startsWith('u')) return 'number'
  if (lower.startsWith('datetime64') || lower.startsWith('datetime')) return 'timestamp'
  if (lower.startsWith('date')) return 'string'
  if (lower.startsWith('array')) return 'array'
  if (lower.startsWith('map') || lower.startsWith('tuple') || lower.startsWith('nested')) return 'object'
  if (lower.startsWith('string') || lower.startsWith('fixedstring') || lower.includes('uuid')) return 'string'
  return 'string'
}

/** Alias map for normalizing various string representations to InternalFieldType */
const TYPE_ALIASES: Record<string, InternalFieldType> = {
  // string family
  str: 'string',
  text: 'string',
  varchar: 'string',
  char: 'string',
  uuid: 'string',
  bytes: 'string',

  // number family
  int: 'number',
  int8: 'number',
  int16: 'number',
  int32: 'number',
  int64: 'number',
  uint: 'number',
  uint8: 'number',
  uint16: 'number',
  uint32: 'number',
  uint64: 'number',
  float: 'number',
  float32: 'number',
  float64: 'number',
  double: 'number',
  decimal: 'number',
  integer: 'number',
  long: 'number',

  // boolean family
  bool: 'boolean',
  boolean: 'boolean',

  // array family
  array: 'array',

  // object family
  object: 'object',
  map: 'object',
  json: 'object',

  // timestamp family
  timestamp: 'timestamp',
  datetime: 'timestamp',
  datetime64: 'timestamp',
  date: 'timestamp',
}

/**
 * Accepts any string label and normalises it to InternalFieldType.
 * Handles case-insensitivity and common aliases.
 */
export function normalizeFieldType(t: string): InternalFieldType {
  const lower = (t ?? '').toLowerCase().trim()
  const valid = new Set<InternalFieldType>([
    'string', 'number', 'boolean', 'object', 'array', 'timestamp',
  ])
  if (valid.has(lower as InternalFieldType)) return lower as InternalFieldType
  return TYPE_ALIASES[lower] ?? 'string'
}
