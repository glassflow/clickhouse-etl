import { describe, it, expect } from 'vitest'
import { isJoinConfigComplete, validateJoinForm } from './joinValidation'

const validStream = {
  streamId: 's1',
  joinKey: 'id',
  joinTimeWindowValue: 1,
  joinTimeWindowUnit: 'minutes',
}

const validStream2 = {
  streamId: 's2',
  joinKey: 'id',
  joinTimeWindowValue: 2,
  joinTimeWindowUnit: 'hours',
}

describe('joinValidation', () => {
  describe('isJoinConfigComplete', () => {
    it('returns false when config is undefined', () => {
      expect(isJoinConfigComplete(undefined)).toBe(false)
    })

    it('returns false when config is null', () => {
      expect(isJoinConfigComplete(null)).toBe(false)
    })

    it('returns false when streams is empty', () => {
      expect(isJoinConfigComplete({ streams: [] })).toBe(false)
    })

    it('returns false when streams has only one item', () => {
      expect(isJoinConfigComplete({ streams: [validStream] })).toBe(false)
    })

    it('returns false when stream is missing joinKey', () => {
      expect(
        isJoinConfigComplete({
          streams: [{ ...validStream, joinKey: '' }, validStream2],
        }),
      ).toBe(false)
    })

    it('returns false when stream is missing joinTimeWindowValue', () => {
      expect(
        isJoinConfigComplete({
          streams: [{ ...validStream, joinTimeWindowValue: 0 }, validStream2],
        }),
      ).toBe(false)
    })

    it('returns false when stream is missing joinTimeWindowUnit', () => {
      expect(
        isJoinConfigComplete({
          streams: [{ ...validStream, joinTimeWindowUnit: '' }, validStream2],
        }),
      ).toBe(false)
    })

    it('returns false when stream is missing streamId', () => {
      expect(
        isJoinConfigComplete({
          streams: [{ ...validStream, streamId: '' }, validStream2],
        }),
      ).toBe(false)
    })

    it('returns true when both streams have all required fields', () => {
      expect(
        isJoinConfigComplete({
          streams: [validStream, validStream2],
        }),
      ).toBe(true)
    })
  })

  describe('validateJoinForm', () => {
    it('returns success and empty errors for valid data', () => {
      const result = validateJoinForm({
        streams: [validStream, validStream2],
      })
      expect(result.success).toBe(true)
      expect(result.errors).toEqual({})
    })

    it('returns errors for missing joinKey', () => {
      const result = validateJoinForm({
        streams: [{ ...validStream, joinKey: '' }, validStream2],
      })
      expect(result.success).toBe(false)
      expect(Object.keys(result.errors).some((k) => k.includes('joinKey'))).toBe(true)
    })

    it('returns errors for invalid time window value', () => {
      const result = validateJoinForm({
        streams: [{ ...validStream, joinTimeWindowValue: 0 }, validStream2],
      })
      expect(result.success).toBe(false)
      expect(Object.keys(result.errors).some((k) => k.includes('joinTimeWindowValue'))).toBe(true)
    })

    it('returns errors for wrong number of streams', () => {
      const result = validateJoinForm({
        streams: [validStream],
      })
      expect(result.success).toBe(false)
      expect(Object.keys(result.errors).length).toBeGreaterThan(0)
    })

    it('returns errors for empty streams array', () => {
      const result = validateJoinForm({ streams: [] })
      expect(result.success).toBe(false)
    })
  })
})
