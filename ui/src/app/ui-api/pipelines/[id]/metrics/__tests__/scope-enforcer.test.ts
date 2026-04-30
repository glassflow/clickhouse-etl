import { describe, expect, it } from 'vitest'
import { enforcePipelineScope } from '../_lib/scope-enforcer'

describe('enforcePipelineScope', () => {
  it('injects label into a metric without selector', () => {
    expect(enforcePipelineScope('records_ingested_total', 'p1')).toBe(
      'records_ingested_total{pipeline_id="p1"}',
    )
  })

  it('injects label into a metric with existing selector', () => {
    expect(enforcePipelineScope('records_ingested_total{component="ingestor"}', 'p1')).toBe(
      'records_ingested_total{component="ingestor",pipeline_id="p1"}',
    )
  })

  it('overrides a forged pipeline_id', () => {
    expect(enforcePipelineScope('records_ingested_total{pipeline_id="other"}', 'p1')).toBe(
      'records_ingested_total{pipeline_id="p1"}',
    )
  })

  it('handles rate() and other functions by recursion', () => {
    expect(enforcePipelineScope('rate(records_ingested_total[5m])', 'p1')).toBe(
      'rate(records_ingested_total{pipeline_id="p1"}[5m])',
    )
  })

  it('handles sum by clauses', () => {
    expect(
      enforcePipelineScope('sum(rate(records_ingested_total[5m])) by (component)', 'p1'),
    ).toBe('sum(rate(records_ingested_total{pipeline_id="p1"}[5m])) by (component)')
  })

  it('refuses to inject into a non-metric expression', () => {
    expect(() => enforcePipelineScope('1 + 1', 'p1')).toThrow(/no metric/)
  })
})
