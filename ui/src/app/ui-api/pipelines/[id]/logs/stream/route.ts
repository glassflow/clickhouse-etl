import { enforceLogsPipelineScope } from '../_lib/logsql-scope'

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

  const upstreamUrl = new URL(`${getVlBase()}/select/logsql/tail`)
  upstreamUrl.searchParams.set('query', query)

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl.toString(), { cache: 'no-store' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch failed'
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`,
      { status: 200, headers: sseHeaders() },
    )
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: `VL ${upstream.status}` })}\n\n`,
      { status: 200, headers: sseHeaders() },
    )
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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`),
        )
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
