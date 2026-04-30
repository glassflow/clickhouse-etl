import { describe, expect, it } from 'vitest'
import { clusterLogs } from '../ContextClusterer'
import type { LogLine } from '@/src/hooks/useLogsQuery'

const line = (i: number, match: boolean): LogLine => ({
  _time: new Date(i * 1000).toISOString(),
  _msg: match ? `MATCH ${i}` : `nope ${i}`,
  pipeline_id: 'p1',
})

describe('clusterLogs', () => {
  it('keeps all lines if no query', () => {
    const lines = [line(1, false), line(2, true), line(3, false)]
    expect(clusterLogs(lines, '', 5)).toEqual([
      { kind: 'line', line: lines[0], index: 0 },
      { kind: 'line', line: lines[1], index: 1 },
      { kind: 'line', line: lines[2], index: 2 },
    ])
  })

  it('keeps all lines if query is whitespace-only', () => {
    const lines = [line(1, false), line(2, true)]
    expect(clusterLogs(lines, '   ', 5).every((x) => x.kind === 'line')).toBe(true)
  })

  it('expands context window of 5 around matches', () => {
    const lines = Array.from({ length: 30 }, (_, i) => line(i, i === 15))
    const out = clusterLogs(lines, 'MATCH', 5)
    const lineCount = out.filter((x) => x.kind === 'line').length
    // 15 ± 5 inclusive = indices 10..20 = 11 lines
    expect(lineCount).toBe(11)
    expect(out.find((x) => x.kind === 'gap')).toBeTruthy()
  })

  it('reports collapsed gap counts', () => {
    const lines = Array.from({ length: 20 }, (_, i) => line(i, i === 10))
    const out = clusterLogs(lines, 'MATCH', 2)
    const gap = out.find((x): x is Extract<typeof x, { kind: 'gap' }> => x.kind === 'gap')
    expect(gap?.collapsedCount).toBeGreaterThan(0)
  })

  it('does case-insensitive substring match', () => {
    const lines = [line(0, false), { ...line(1, false), _msg: 'hello WORLD' }, line(2, false)]
    const out = clusterLogs(lines, 'world', 1)
    const lineItems = out.filter((x) => x.kind === 'line')
    // 'hello WORLD' itself + 1 of context each side = 3 lines
    expect(lineItems.length).toBe(3)
  })

  it('merges adjacent matches into one cluster', () => {
    const lines = Array.from({ length: 10 }, (_, i) => line(i, i === 4 || i === 5))
    const out = clusterLogs(lines, 'MATCH', 1)
    // matches at 4,5; window expands to [3..6] = 4 lines, no gap between them
    const gaps = out.filter((x) => x.kind === 'gap')
    expect(gaps.length).toBeLessThanOrEqual(2) // a leading and/or trailing gap, but none in between
    const lineItems = out.filter((x) => x.kind === 'line')
    expect(lineItems.length).toBe(4)
  })
})
