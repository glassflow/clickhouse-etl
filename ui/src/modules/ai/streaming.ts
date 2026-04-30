// SSE streaming helpers — encoder used by the chat route, consumer used by the
// drawer client. Events are JSON-serialized and framed with `data: <json>\n\n`.

import type { StreamEvent } from './types'

/** Format a `StreamEvent` as a single SSE frame. */
export function encodeEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Async iterator that pulls SSE frames from a fetch `Response.body` and yields
 * parsed `StreamEvent` objects. Skips malformed events silently.
 */
export async function* consumeStream(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE: events separated by blank line (\n\n); each event has lines
      // prefixed with `data: `. We only support data frames (no `event:` etc).
      let idx
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const eventChunk = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const dataLine = eventChunk.split('\n').find((l) => l.startsWith('data: '))
        if (!dataLine) continue
        const json = dataLine.slice(6)
        if (json === '[DONE]') return
        try {
          yield JSON.parse(json) as StreamEvent
        } catch {
          /* malformed event — skip */
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
