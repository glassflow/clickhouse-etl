import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { validateCanvas } from '../canvas-validation'

const sourceNode = (id: string): Node => ({
  id,
  type: 'kafkaSource',
  position: { x: 0, y: 0 },
  data: { label: 'Kafka' },
})
const sinkNode = (id: string): Node => ({
  id,
  type: 'clickhouseSink',
  position: { x: 200, y: 0 },
  data: { label: 'ClickHouse' },
})
const edge = (s: string, t: string): Edge => ({ id: `e-${s}-${t}`, source: s, target: t })

describe('validateCanvas', () => {
  it('flags an unconnected source as warning', () => {
    const r = validateCanvas([sourceNode('a'), sinkNode('b')], [], {})
    expect(r.byNode.a.some((m) => m.code === 'unconnected_output')).toBe(true)
  })

  it('flags an unconnected sink input as error', () => {
    const r = validateCanvas([sourceNode('a'), sinkNode('b')], [], {})
    expect(r.byNode.b.some((m) => m.code === 'unconnected_input')).toBe(true)
  })

  it('clears unconnected errors once edges connect them', () => {
    const r = validateCanvas([sourceNode('a'), sinkNode('b')], [edge('a', 'b')], {
      a: { connectionRefId: 'k1', topics: [{ name: 't', schemaRefId: 's1' }] },
      b: { connectionRefId: 'c1', table: 'orders', database: 'db' },
    })
    expect(r.byNode.a.find((m) => m.code === 'unconnected_output')).toBeUndefined()
    expect(r.byNode.b.find((m) => m.code === 'unconnected_input')).toBeUndefined()
  })

  it('flags missing required source config', () => {
    const r = validateCanvas([sourceNode('a'), sinkNode('b')], [edge('a', 'b')], {
      a: {},
      b: {},
    })
    expect(r.byNode.a.some((m) => m.code === 'missing_required' && m.severity === 'error')).toBe(
      true,
    )
  })

  it('produces a hasErrors=true summary when any error exists', () => {
    const r = validateCanvas([sourceNode('a'), sinkNode('b')], [], {})
    expect(r.summary.hasErrors).toBe(true)
    expect(r.summary.errorCount).toBeGreaterThan(0)
  })

  it('hasErrors=false on a fully wired pipeline', () => {
    const r = validateCanvas([sourceNode('a'), sinkNode('b')], [edge('a', 'b')], {
      a: { connectionRefId: 'k1', topics: [{ name: 't' }] },
      b: { connectionRefId: 'c1', database: 'db', table: 'orders' },
    })
    expect(r.summary.hasErrors).toBe(false)
  })
})
