import semver from 'semver'

export type SemverBump = 'major' | 'minor' | 'patch'

export function computeNextSemver(latest: string | null, bump: SemverBump): string {
  if (!latest) return '1.0.0'
  const cleaned = semver.coerce(latest)?.version
  if (!cleaned) return '1.0.0'
  return semver.inc(cleaned, bump) ?? '1.0.0'
}
