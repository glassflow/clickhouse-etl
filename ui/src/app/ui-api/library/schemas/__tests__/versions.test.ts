import { describe, expect, it } from 'vitest'
import { computeNextSemver } from '../[id]/versions/semver-util'

describe('computeNextSemver', () => {
  it('starts at 1.0.0 if no previous versions', () => {
    expect(computeNextSemver(null, 'minor')).toBe('1.0.0')
    expect(computeNextSemver(null, 'major')).toBe('1.0.0')
    expect(computeNextSemver(null, 'patch')).toBe('1.0.0')
  })

  it('bumps major from 1.4.2 to 2.0.0', () => {
    expect(computeNextSemver('1.4.2', 'major')).toBe('2.0.0')
  })

  it('bumps minor from 1.4.2 to 1.5.0', () => {
    expect(computeNextSemver('1.4.2', 'minor')).toBe('1.5.0')
  })

  it('bumps patch from 1.4.2 to 1.4.3', () => {
    expect(computeNextSemver('1.4.2', 'patch')).toBe('1.4.3')
  })

  it('ignores pre-release segments', () => {
    expect(computeNextSemver('1.4.2-rc.1', 'minor')).toBe('1.5.0')
  })
})
