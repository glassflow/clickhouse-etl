import { describe, expect, it } from 'vitest'
import { enforceLogsPipelineScope } from '../_lib/logsql-scope'

describe('enforceLogsPipelineScope', () => {
  it('prepends pipeline_id when missing', () => {
    expect(enforceLogsPipelineScope('severity:error', 'p1')).toBe(
      'pipeline_id:"p1" severity:error',
    )
  })

  it('replaces a forged pipeline_id', () => {
    expect(enforceLogsPipelineScope('pipeline_id:"other" severity:error', 'p1')).toBe(
      'pipeline_id:"p1" severity:error',
    )
  })

  it('handles empty input', () => {
    expect(enforceLogsPipelineScope('', 'p1')).toBe('pipeline_id:"p1"')
  })

  it('handles _msg fuzzy search', () => {
    expect(enforceLogsPipelineScope('"connection refused"', 'p1')).toBe(
      'pipeline_id:"p1" "connection refused"',
    )
  })

  it('handles negated filters preserves them', () => {
    expect(enforceLogsPipelineScope('-severity:debug', 'p1')).toBe(
      'pipeline_id:"p1" -severity:debug',
    )
  })

  it('escapes embedded double quotes in pipelineId', () => {
    expect(enforceLogsPipelineScope('severity:error', 'p"1')).toBe(
      'pipeline_id:"p\\"1" severity:error',
    )
  })

  it('strips a forged negated pipeline_id and overrides it', () => {
    expect(enforceLogsPipelineScope('-pipeline_id:"other" severity:error', 'p1')).toBe(
      'pipeline_id:"p1" severity:error',
    )
  })
})
