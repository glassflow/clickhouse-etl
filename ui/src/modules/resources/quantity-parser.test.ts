import { describe, it, expect } from 'vitest'
import {
  validateKubernetesQuantity,
  validateNatsMaxBytes,
  validateNatsMaxAge,
} from './quantity-parser'

describe('validateKubernetesQuantity', () => {
  it('accepts empty string', () => {
    expect(validateKubernetesQuantity('')).toEqual({ valid: true })
  })

  it('accepts valid CPU/memory/storage quantities', () => {
    const valid = ['100m', '1', '128Mi', '1.5Gi', '1e3', '500m', '10Gi', '2', '256Mi', '1048576']
    for (const val of valid) {
      expect(validateKubernetesQuantity(val)).toEqual({ valid: true })
    }
  })

  it('accepts exponent format', () => {
    expect(validateKubernetesQuantity('1e3')).toEqual({ valid: true })
    expect(validateKubernetesQuantity('1E-2')).toEqual({ valid: true })
  })

  it('rejects invalid quantities', () => {
    const invalid = ['1GB', '10gigs', 'bad', 'abc', '1.1234']
    for (const val of invalid) {
      const result = validateKubernetesQuantity(val)
      expect(result.valid).toBe(false)
      expect((result as { valid: false; error: string }).error).toBeTruthy()
    }
  })

  it('rejects 1GB (use 1G or 1Gi for Kubernetes)', () => {
    const result = validateKubernetesQuantity('1GB')
    expect(result.valid).toBe(false)
  })

  it('accepts 1G and 1Gi', () => {
    expect(validateKubernetesQuantity('1G')).toEqual({ valid: true })
    expect(validateKubernetesQuantity('1Gi')).toEqual({ valid: true })
  })

  it('accepts trimmed values', () => {
    expect(validateKubernetesQuantity('  128Mi  ')).toEqual({ valid: true })
  })
})

describe('validateNatsMaxBytes', () => {
  it('accepts empty string', () => {
    expect(validateNatsMaxBytes('')).toEqual({ valid: true })
  })

  it('accepts Kubernetes quantity format', () => {
    expect(validateNatsMaxBytes('10Gi')).toEqual({ valid: true })
    expect(validateNatsMaxBytes('1048576')).toEqual({ valid: true })
  })

  it('accepts human byte format', () => {
    const valid = ['10Gi', '100GB', '1TB', '1.5TB', '512MB', '1024KB']
    for (const val of valid) {
      expect(validateNatsMaxBytes(val)).toEqual({ valid: true })
    }
  })

  it('rejects invalid format', () => {
    const result = validateNatsMaxBytes('10gigs')
    expect(result.valid).toBe(false)
    expect((result as { valid: false; error: string }).error).toBeTruthy()
  })
})

describe('validateNatsMaxAge', () => {
  it('accepts empty string', () => {
    expect(validateNatsMaxAge('')).toEqual({ valid: true })
  })

  it('accepts valid duration format', () => {
    const valid = ['24h', '1m', '30s', '1h30m', '1.5h']
    for (const val of valid) {
      expect(validateNatsMaxAge(val)).toEqual({ valid: true })
    }
  })

  it('rejects bare number without unit', () => {
    const result = validateNatsMaxAge('24')
    expect(result.valid).toBe(false)
  })

  it('rejects invalid format', () => {
    const result = validateNatsMaxAge('abc')
    expect(result.valid).toBe(false)
    expect((result as { valid: false; error: string }).error).toBeTruthy()
  })
})
