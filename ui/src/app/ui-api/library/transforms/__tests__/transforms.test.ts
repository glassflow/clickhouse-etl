import { describe, expect, it } from 'vitest'
import { CreateTransformInput, PublishTransformVersionInput } from '@/src/lib/db/validations'

describe('transform validations', () => {
  it('rejects empty code', () => {
    const r = CreateTransformInput.safeParse({ name: 'x', language: 'js', code: '' })
    expect(r.success).toBe(false)
  })

  it('rejects unknown language', () => {
    const r = CreateTransformInput.safeParse({ name: 'x', language: 'go', code: 'a' })
    expect(r.success).toBe(false)
  })

  it('accepts a minimal valid payload', () => {
    const r = CreateTransformInput.safeParse({ name: 'norm', language: 'js', code: 'return e' })
    expect(r.success).toBe(true)
  })

  it('publish bump validates', () => {
    const r = PublishTransformVersionInput.safeParse({
      bump: 'minor',
      language: 'js',
      code: 'return e',
    })
    expect(r.success).toBe(true)
  })
})
