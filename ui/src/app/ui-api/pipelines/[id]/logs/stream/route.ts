import { enforceLogsPipelineScope } from '../_lib/logsql-scope'
import { isMockMode } from '@/src/utils/mock-api'
import { buildLogsFixture, parseScenario } from '../../_mock/fixtures'

type Params = { params: Promise<{ id: string }> }

function getVlBase(): string {
  return process.env.VICTORIA_LOGS_URL ?? 'http://victorialogs:9428'
}

/**
 * GET /ui-api/pipelines/:id/logs/stream
 *
 * Server-scope-enforced VictoriaLogs SSE tail. Connects to
 * `GET /select/logsql/tail?query=…`, which streams NDJSON, and re-encodes
 * each well-formed line as a Server-Sent Event for browser EventSource
 * compatibility. The query is rewritten to prepend `pipeline_id:"<id>"`
 * before being forwarded — forging a `pipeline_id` filter is impossible.
 */
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params
  const url = new URL(req.url)
  const rawQuery = url.searchParams.get('query') ?? ''
  const query = enforceLogsPipelineScope(rawQuery, id)

  if (isMockMode()) {
    return mockSseStream({
      pipelineId: id,
      query,
      scenario: parseScenario(url.searchParams.get('mock')),
    })
  }

  const upstreamUrl = new URL(`${getVlBase()}/select/logsql/tail`)
  upstreamUrl.searchParams.set('query', query)

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl.toString(), { cache: 'no-store' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch failed'
    return new Response(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`, {
      status: 200,
      headers: sseHeaders(),
    })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(`data: ${JSON.stringify({ type: 'error', message: `VL ${upstream.status}` })}\n\n`, {
      status: 200,
      headers: sseHeaders(),
    })
  }

  // Re-encode NDJSON → SSE.
  const encoder = new TextEncoder()
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let nl
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl)
            buffer = buffer.slice(nl + 1)
            if (!line.trim()) continue
            try {
              JSON.parse(line) // validate
              controller.enqueue(encoder.encode(`data: ${line}\n\n`))
            } catch {
              /* drop malformed */
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
    cancel() {
      reader.cancel().catch(() => {})
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}

function sseHeaders(): HeadersInit {
  return {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  }
}

/**
 * Mock-mode SSE: emit an initial burst of seeded log lines, then drip-feed
 * new lines on an interval so the live-tail feel is preserved. The browser's
 * EventSource will see exactly the same `data: {…json…}\n\n` framing as the
 * real VictoriaLogs proxy above.
 */
function mockSseStream({
  pipelineId,
  query,
  scenario,
}: {
  pipelineId: string
  query: string
  scenario: 'populated' | 'empty' | 'retention' | 'error'
}): Response {
  const encoder = new TextEncoder()
  const now = Date.now()
  let dripInterval: ReturnType<typeof setInterval> | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const cleanup = () => {
    if (dripInterval) clearInterval(dripInterval)
    if (heartbeat) clearInterval(heartbeat)
    dripInterval = null
    heartbeat = null
  }

  const stream = new ReadableStream({
    start(controller) {
      if (scenario === 'error') {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'VL 503 (mock)' })}\n\n`))
        controller.close()
        return
      }

      // Initial burst — covers the last 5 minutes so the buffer renders
      // immediately on connect instead of waiting for the first drip.
      if (scenario !== 'empty') {
        const burst = buildLogsFixture({
          pipelineId,
          query,
          fromMs: now - 5 * 60 * 1000,
          toMs: now,
          limit: 40,
          scenario: 'populated',
        })
        // useLogStream appends in arrival order — emit oldest first so the
        // newest end up at the bottom (matches the live-tail expectation).
        for (const line of [...burst.lines].reverse()) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`))
        }
      }

      let tick = 0
      dripInterval = setInterval(() => {
        if (scenario === 'empty') return // keep connection alive, no lines
        tick++
        const fresh = buildLogsFixture({
          pipelineId: `${pipelineId}|tick${tick}`,
          query,
          fromMs: Date.now() - 1000,
          toMs: Date.now(),
          limit: 1 + Math.floor(Math.random() * 2),
          scenario: 'populated',
        })
        for (const line of fresh.lines) {
          // Stamp to *now* so the inspector's timestamps look live.
          line._time = new Date().toISOString()
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`))
          } catch {
            cleanup()
          }
        }
      }, 900)

      // SSE comment — keeps proxies from buffering the empty scenario.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          cleanup()
        }
      }, 15_000)
    },
    cancel() {
      // Browsers call this when the EventSource on the client closes.
      cleanup()
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}
