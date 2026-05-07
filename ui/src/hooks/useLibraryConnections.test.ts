import { describe, it, expect } from 'vitest'
import type { LibrarySchema } from './useLibraryConnections'

describe('LibrarySchema type shape', () => {
  it('has latestVersion, hasDrift, usedByCount', () => {
    const s: LibrarySchema = {
      id: 's1',
      name: 'events',
      description: null,
      folderId: null,
      tags: [],
      fields: [],
      createdAt: '',
      updatedAt: '',
      latestVersion: 'v3',
      hasDrift: false,
      usedByCount: 2,
    }
    expect(s.latestVersion).toBe('v3')
    expect(s.hasDrift).toBe(false)
    expect(s.usedByCount).toBe(2)
  })

  it('allows hasDrift to be true and usedByCount to be 0', () => {
    const s: LibrarySchema = {
      id: 's2',
      name: 'users',
      description: null,
      folderId: null,
      tags: [],
      fields: [],
      createdAt: '',
      updatedAt: '',
      latestVersion: 'v2',
      hasDrift: true,
      usedByCount: 0,
    }
    expect(s.hasDrift).toBe(true)
    expect(s.usedByCount).toBe(0)
  })
})
