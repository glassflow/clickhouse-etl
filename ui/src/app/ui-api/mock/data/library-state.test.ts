import { describe, it, expect } from 'vitest'
import { listDedupConfigs, getDedupConfig } from './library-state'

describe('DedupConfig state', () => {
  it('listDedupConfigs returns at least 2 items', () => {
    const items = listDedupConfigs()
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('getDedupConfig returns item by id', () => {
    const items = listDedupConfigs()
    const first = items[0]
    expect(getDedupConfig(first.id)).toEqual(first)
  })

  it('getDedupConfig returns undefined for unknown id', () => {
    expect(getDedupConfig('nonexistent')).toBeUndefined()
  })
})
