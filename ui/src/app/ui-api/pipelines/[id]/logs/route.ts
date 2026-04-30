import { NextResponse } from 'next/server'
import { enforceLogsPipelineScope } from './_lib/logsql-scope'

type Params = { params: Promise<{ id: string }> }

function getVlBase(): string {
  return process.env.VICTORIA_LOGS_URL ?? 'http://victorialogs:9428'
}

/**
 * GET /ui-api/pipelines/:id/logs
 *
 * Server-scope-enforced VictoriaLogs proxy. Every LogsQL query — whether the
 * UI sends an empty string or a free-form filter expression — is rewritten
 * to prepend `pipeline_id:"<id>"` before being forwarded to VL. See master
 * plan § D5.
 *
 * Returns the raw NDJSON parsed into `{ query, lines, count }`.
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const url = new URL(req.url)
  const rawQuery = url.searchParams.get('query') ?? ''
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const limitParam = Number(url.searchParams.get('limit') ?? '200')
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 5_000) : 200

  const query = enforceLogsPipelineScope(rawQuery, id)

  const fromSec = from ? Math.floor(Number(from) / 1000) : Math.floor(Date.now() / 1000) - 3600
  const toSec = to ? Math.floor(Number(to) / 1000) : Math.floor(Date.now() / 1000)

  const vlUrl = new URL(`${getVlBase()}/select/logsql/query`)
  vlUrl.searchParams.set('query', query)
  vlUrl.searchParams.set('start', String(fromSec))
  vlUrl.searchParams.set('end', String(toSec))
  vlUrl.searchParams.set('limit', String(limit))

  try {
    const res = await fetch(vlUrl.toString(), { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: `VL ${res.status}` }, { status: 503 })
    }

    // VL returns NDJSON (one JSON object per line).
    const text = await res.text()
    const lines = text
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((v): v is Record<string, unknown> => v !== null)
    return NextResponse.json({ query, lines, count: lines.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'fetch failed' },
      { status: 503 },
    )
  }
}
