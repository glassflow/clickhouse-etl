import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { isValidNodeConnection } from '../canvas-validation'

const makeNode = (type: string, id?: string): Node => ({
  id: id ?? type,
  type,
  position: { x: 0, y: 0 },
  data: {},
})

describe('isValidNodeConnection', () => {
  it('allows source → transform', () => {
    expect(isValidNodeConnection(makeNode('kafkaSource'), makeNode('filter'))).toBe(true)
  })
  it('allows transform → sink', () => {
    expect(isValidNodeConnection(makeNode('transform'), makeNode('clickhouseSink'))).toBe(true)
  })
  it('disallows sink → source', () => {
    expect(isValidNodeConnection(makeNode('clickhouseSink'), makeNode('kafkaSource'))).toBe(false)
  })
  it('disallows source → source', () => {
    expect(
      isValidNodeConnection(makeNode('kafkaSource', 's1'), makeNode('kafkaSource', 's2')),
    ).toBe(false)
  })
  it('disallows sink → sink', () => {
    expect(
      isValidNodeConnection(
        makeNode('clickhouseSink', 'k1'),
        makeNode('clickhouseSink', 'k2'),
      ),
    ).toBe(false)
  })
  it('disallows self-loops', () => {
    expect(
      isValidNodeConnection(makeNode('filter', 'same'), makeNode('filter', 'same')),
    ).toBe(false)
  })
  it('returns false for nullish inputs', () => {
    expect(isValidNodeConnection(null, makeNode('filter'))).toBe(false)
    expect(isValidNodeConnection(makeNode('kafkaSource'), undefined)).toBe(false)
  })
  it('allows transform → transform (compose chain)', () => {
    expect(
      isValidNodeConnection(makeNode('filter', 'f'), makeNode('transform', 't')),
    ).toBe(true)
  })
})
