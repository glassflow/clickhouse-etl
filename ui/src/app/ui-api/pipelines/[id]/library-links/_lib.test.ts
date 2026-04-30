import { describe, it, expect } from 'vitest'
import { computeDrift } from './_lib'

describe('computeDrift', () => {
  it('returns "none" when pinned or latest is missing', () => {
    expect(computeDrift(null, null)).toBe('none')
    expect(computeDrift(null, '1.0.0')).toBe('none')
    expect(computeDrift('1.0.0', null)).toBe('none')
  })

  it('returns "none" when versions are equal', () => {
    expect(computeDrift('1.2.3', '1.2.3')).toBe('none')
  })

  it('returns "patch" when only patch version differs', () => {
    expect(computeDrift('1.2.3', '1.2.4')).toBe('patch')
  })

  it('returns "minor" when minor version differs (major equal)', () => {
    expect(computeDrift('1.2.3', '1.3.0')).toBe('minor')
  })

  it('returns "major" when major version differs', () => {
    expect(computeDrift('1.2.3', '2.0.0')).toBe('major')
    expect(computeDrift('1.0.0', '3.4.5')).toBe('major')
  })

  it('coerces semver-ish strings (v-prefix, partial)', () => {
    expect(computeDrift('v1', 'v1.0.0')).toBe('none')
    expect(computeDrift('1', '2')).toBe('major')
  })

  it('returns "none" for non-semver strings that fail coercion', () => {
    expect(computeDrift('abc', 'def')).toBe('none')
  })

  it('falls through to "patch" if latest < pinned (forward-only contract)', () => {
    // The function assumes the standard direction (latest >= pinned). When
    // pinned is somehow ahead — e.g. a manual override or a stale read of the
    // latest version — the function falls through to 'patch' rather than
    // raising. The UI never surfaces an Upgrade button for that direction in
    // practice, but the unit test pins the current behavior.
    expect(computeDrift('2.0.0', '1.0.0')).toBe('patch')
  })
})
