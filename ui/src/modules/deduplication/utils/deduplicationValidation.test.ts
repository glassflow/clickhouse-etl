import { describe, it, expect } from 'vitest'
import { isDeduplicationConfigComplete } from './deduplicationValidation'

describe('deduplicationValidation', () => {
  describe('isDeduplicationConfigComplete', () => {
    it('returns false when config is undefined', () => {
      expect(isDeduplicationConfigComplete(undefined)).toBe(false)
    })

    it('returns false when key is empty', () => {
      expect(
        isDeduplicationConfigComplete({
          enabled: true,
          key: '',
          window: 1,
          unit: 'hours',
          keyType: 'string',
        }),
      ).toBe(false)
    })

    it('returns false when window is 0', () => {
      expect(
        isDeduplicationConfigComplete({
          enabled: true,
          key: 'id',
          window: 0,
          unit: 'hours',
          keyType: 'string',
        }),
      ).toBe(false)
    })

    it('returns false when unit is empty', () => {
      expect(
        isDeduplicationConfigComplete({
          enabled: true,
          key: 'id',
          window: 1,
          unit: '',
          keyType: 'string',
        }),
      ).toBe(false)
    })

    it('returns true when key, window, and unit are set', () => {
      expect(
        isDeduplicationConfigComplete({
          enabled: true,
          key: 'id',
          window: 2,
          unit: 'days',
          keyType: 'string',
        }),
      ).toBe(true)
    })
  })
})
