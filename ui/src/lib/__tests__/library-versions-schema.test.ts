import { describe, expect, it } from 'vitest'
import { schemaVersions, transforms, transformVersions } from '@/src/lib/db/schema'

describe('library version schema', () => {
  it('exposes the schemaVersions table with expected columns', () => {
    expect(schemaVersions).toBeDefined()
    const cols = Object.keys(schemaVersions)
    expect(cols).toContain('schemaId')
    expect(cols).toContain('version')
    expect(cols).toContain('fields')
    expect(cols).toContain('changeSummary')
  })

  it('exposes the transforms table with expected columns', () => {
    expect(transforms).toBeDefined()
    const cols = Object.keys(transforms)
    expect(cols).toContain('name')
    expect(cols).toContain('code')
    expect(cols).toContain('language')
  })

  it('exposes the transformVersions table with expected columns', () => {
    expect(transformVersions).toBeDefined()
    const cols = Object.keys(transformVersions)
    expect(cols).toContain('transformId')
    expect(cols).toContain('version')
  })
})
