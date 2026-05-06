import { describe, it, expect } from 'vitest'
import type { UsedByEntry } from './useLibraryDetail'

describe('UsedByEntry type shape', () => {
  it('has health, status, drift fields', () => {
    const entry: UsedByEntry = {
      pipelineId: 'p1',
      pipelineName: 'My Pipeline',
      pinnedVersion: 'v2',
      health: 'ok',
      status: 'active',
      drift: false,
    }
    expect(entry.health).toBe('ok')
    expect(entry.status).toBe('active')
    expect(entry.drift).toBe(false)
  })

  it('allows warn/err/stopped variants', () => {
    const e: UsedByEntry = {
      pipelineId: 'p2',
      pipelineName: 'Broken',
      health: 'err',
      status: 'stopped',
      drift: true,
    }
    expect(e.health).toBe('err')
    expect(e.drift).toBe(true)
  })
})
