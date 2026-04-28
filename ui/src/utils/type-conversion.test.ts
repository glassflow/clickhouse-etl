import { describe, test, expect } from 'vitest'
import { jsonTypeToClickHouseType, clickHouseTypeToJsonType, normalizeFieldType } from './type-conversion'
import type { InternalFieldType } from '../types/schema'

test.each([
  ['string',    'String'],
  ['number',    'Float64'],
  ['boolean',   'UInt8'],
  ['timestamp', 'DateTime64(3)'],
  ['object',    'String'],
] as [InternalFieldType, string][])('jsonTypeToClickHouseType(%s) = %s', (json, ch) => {
  expect(jsonTypeToClickHouseType(json as InternalFieldType)).toBe(ch)
})

test('roundtrip: json → CH → json preserves type for scalar types', () => {
  const types: InternalFieldType[] = ['string', 'number', 'boolean', 'timestamp']
  types.forEach(t => {
    expect(clickHouseTypeToJsonType(jsonTypeToClickHouseType(t))).toBe(t)
  })
})

describe('clickHouseTypeToJsonType', () => {
  test('returns string for unknown type', () => {
    expect(clickHouseTypeToJsonType('SomeUnknownType')).toBe('string')
  })

  test('handles Nullable wrapper', () => {
    expect(clickHouseTypeToJsonType('Nullable(String)')).toBe('string')
    expect(clickHouseTypeToJsonType('Nullable(Float64)')).toBe('number')
  })

  test('handles LowCardinality wrapper', () => {
    expect(clickHouseTypeToJsonType('LowCardinality(String)')).toBe('string')
  })

  test('maps Int32 to number', () => {
    expect(clickHouseTypeToJsonType('Int32')).toBe('number')
  })

  test('maps Array(...) to array', () => {
    expect(clickHouseTypeToJsonType('Array(String)')).toBe('array')
  })

  test('maps DateTime to timestamp', () => {
    expect(clickHouseTypeToJsonType('DateTime')).toBe('timestamp')
  })
})

describe('normalizeFieldType', () => {
  test('passes through valid InternalFieldType values', () => {
    const valid: InternalFieldType[] = ['string', 'number', 'boolean', 'object', 'array', 'timestamp']
    valid.forEach(t => {
      expect(normalizeFieldType(t)).toBe(t)
    })
  })

  test('normalizes case-insensitive aliases', () => {
    expect(normalizeFieldType('INT')).toBe('number')
    expect(normalizeFieldType('FLOAT')).toBe('number')
    expect(normalizeFieldType('BOOL')).toBe('boolean')
    expect(normalizeFieldType('TEXT')).toBe('string')
  })

  test('normalizes legacy types', () => {
    expect(normalizeFieldType('int')).toBe('number')
    expect(normalizeFieldType('float')).toBe('number')
    expect(normalizeFieldType('bool')).toBe('boolean')
    expect(normalizeFieldType('bytes')).toBe('string')
    expect(normalizeFieldType('map')).toBe('object')
  })

  test('returns string for empty/unknown input', () => {
    expect(normalizeFieldType('')).toBe('string')
    expect(normalizeFieldType('unknownXYZ')).toBe('string')
  })
})
