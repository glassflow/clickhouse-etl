import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /ui-api/mock/library/filter', () => {
  it('returns a list of filter configs', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(2)
    expect(body[0]).toHaveProperty('id')
    expect(body[0]).toHaveProperty('rules')
  })
})
