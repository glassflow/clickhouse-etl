import { describe, it, expect } from 'vitest'
import { extractEventFields, compareEventSchemas } from './common.client'

describe('common.client', () => {
  describe('extractEventFields', () => {
    it('returns list of keys for flat object', () => {
      const data = { id: 1, name: 'a', count: 0 }
      const result = extractEventFields(data)
      expect(result.sort()).toEqual(['id', 'name', 'count'].sort())
    })

    it('returns dot-notation paths for nested object', () => {
      const data = {
        id: 1,
        user: {
          name: 'John',
          address: {
            city: 'NYC',
          },
        },
      }
      const result = extractEventFields(data)
      expect(result.sort()).toEqual(['id', 'user.name', 'user.address.city'].sort())
    })

    it('adds array as single field', () => {
      const data = { id: 1, tags: ['a', 'b'] }
      const result = extractEventFields(data)
      expect(result).toContain('id')
      expect(result).toContain('tags')
      expect(result).toHaveLength(2)
    })

    it('skips keys starting with _metadata', () => {
      const data = { id: 1, _metadata: { ts: 123 }, _metadataExtra: 0 }
      const result = extractEventFields(data)
      expect(result).toContain('id')
      expect(result).not.toContain('_metadata')
      expect(result).not.toContain('_metadataExtra')
    })

    it('returns empty array for null or non-object', () => {
      expect(extractEventFields(null)).toEqual([])
      expect(extractEventFields(undefined)).toEqual([])
      expect(extractEventFields('string')).toEqual([])
      expect(extractEventFields(42)).toEqual([])
    })
  })

  describe('compareEventSchemas', () => {
    it('returns true when both null or both undefined', () => {
      expect(compareEventSchemas(null, null)).toBe(true)
      expect(compareEventSchemas(undefined, undefined)).toBe(true)
    })

    it('returns false when one is null/undefined and the other is not', () => {
      expect(compareEventSchemas(null, { a: 1 })).toBe(false)
      expect(compareEventSchemas({ a: 1 }, null)).toBe(false)
      expect(compareEventSchemas(undefined, { a: 1 })).toBe(false)
    })

    it('returns true when same field names (structure)', () => {
      expect(compareEventSchemas({ id: 1, name: 'a' }, { id: 99, name: 'b' })).toBe(true)
    })

    it('returns false when different keys', () => {
      expect(compareEventSchemas({ id: 1 }, { id: 1, name: 'a' })).toBe(false)
      expect(compareEventSchemas({ id: 1, name: 'a' }, { id: 1 })).toBe(false)
      expect(compareEventSchemas({ a: 1 }, { b: 1 })).toBe(false)
    })

    it('returns true for nested same structure', () => {
      const a = { user: { name: 'x' } }
      const b = { user: { name: 'y' } }
      expect(compareEventSchemas(a, b)).toBe(true)
    })

    it('returns false for nested different structure', () => {
      const a = { user: { name: 'x' } }
      const b = { user: { name: 'x', age: 1 } }
      expect(compareEventSchemas(a, b)).toBe(false)
    })

    it('ignores _metadata in comparison', () => {
      const a = { id: 1, _metadata: { ts: 1 } }
      const b = { id: 2, _metadata: { ts: 2 } }
      expect(compareEventSchemas(a, b)).toBe(true)
    })
  })
})
