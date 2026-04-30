import { describe, it, expect } from 'vitest'
import { encodeEvent, consumeStream } from '../streaming'
import type { StreamEvent } from '../types'

function makeResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream)
}

describe('encodeEvent', () => {
  it('frames a StreamEvent as `data: <json>\\n\\n`', () => {
    const ev: StreamEvent = { type: 'message_start', messageId: 'm-1' }
    expect(encodeEvent(ev)).toBe(`data: ${JSON.stringify(ev)}\n\n`)
  })
})

describe('consumeStream', () => {
  it('parses well-formed SSE frames into StreamEvents', async () => {
    const events: StreamEvent[] = [
      { type: 'message_start', messageId: 'm-1' },
      { type: 'text_delta', messageId: 'm-1', delta: 'Hello' },
      { type: 'text_delta', messageId: 'm-1', delta: ' world' },
      { type: 'message_stop', messageId: 'm-1', tokensUsed: 12 },
    ]
    const wire = events.map(encodeEvent).join('')
    const collected: StreamEvent[] = []
    for await (const ev of consumeStream(makeResponse([wire]))) {
      collected.push(ev)
    }
    expect(collected).toEqual(events)
  })

  it('handles split chunks (event boundary mid-buffer)', async () => {
    const events: StreamEvent[] = [
      { type: 'message_start', messageId: 'm-1' },
      { type: 'text_delta', messageId: 'm-1', delta: 'partial' },
    ]
    const wire = events.map(encodeEvent).join('')
    // Split mid-event: roughly half of the bytes in the first chunk.
    const half = Math.floor(wire.length / 2)
    const collected: StreamEvent[] = []
    for await (const ev of consumeStream(makeResponse([wire.slice(0, half), wire.slice(half)]))) {
      collected.push(ev)
    }
    expect(collected).toEqual(events)
  })

  it('skips malformed JSON frames silently', async () => {
    const good: StreamEvent = { type: 'message_start', messageId: 'm-1' }
    const wire = `data: ${JSON.stringify(good)}\n\ndata: {not json\n\n`
    const collected: StreamEvent[] = []
    for await (const ev of consumeStream(makeResponse([wire]))) {
      collected.push(ev)
    }
    expect(collected).toEqual([good])
  })

  it('returns immediately on `[DONE]` sentinel', async () => {
    const wire =
      `data: ${JSON.stringify({ type: 'message_start', messageId: 'm-1' })}\n\n` +
      `data: [DONE]\n\n` +
      `data: ${JSON.stringify({ type: 'text_delta', messageId: 'm-1', delta: 'unread' })}\n\n`
    const collected: StreamEvent[] = []
    for await (const ev of consumeStream(makeResponse([wire]))) {
      collected.push(ev)
    }
    expect(collected).toHaveLength(1)
    expect(collected[0]).toEqual({ type: 'message_start', messageId: 'm-1' })
  })
})
