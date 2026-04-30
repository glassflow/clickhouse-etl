'use client'

import * as React from 'react'
import type { LogLine } from './useLogsQuery'

const MAX_BUFFER = 500

type StreamMeta = {
  lines: LogLine[]
  error: string | null
  connected: boolean
  clear: () => void
}

/**
 * Live-tail logs SSE consumer.
 *
 * Connects to `/ui-api/pipelines/:id/logs/stream?query=…` via EventSource and
 * buffers up to `MAX_BUFFER` log lines (oldest dropped first). Closes the
 * connection when `paused` flips true. Re-opens on query/pause changes.
 */
export function useLogStream(pipelineId: string, query: string, paused: boolean): StreamMeta {
  const [lines, setLines] = React.useState<LogLine[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    if (paused) {
      setConnected(false)
      return
    }
    const url = `/ui-api/pipelines/${pipelineId}/logs/stream?query=${encodeURIComponent(query)}`
    const es = new EventSource(url)
    setError(null)

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data)
        if (parsed && typeof parsed === 'object' && parsed.type === 'error') {
          setError(typeof parsed.message === 'string' ? parsed.message : 'stream error')
          return
        }
        setLines((prev) => {
          const next = [...prev, parsed as LogLine]
          return next.length > MAX_BUFFER ? next.slice(next.length - MAX_BUFFER) : next
        })
      } catch {
        /* skip malformed payload */
      }
    }

    es.onerror = () => {
      setError('stream disconnected')
      setConnected(false)
    }

    return () => {
      es.close()
      setConnected(false)
    }
  }, [pipelineId, query, paused])

  const clear = React.useCallback(() => setLines([]), [])

  return { lines, error, connected, clear }
}
