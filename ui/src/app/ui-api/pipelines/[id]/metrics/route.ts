import { NextResponse } from 'next/server'
import { CANONICAL_QUERIES, isCanonicalKey } from './_lib/canonical-queries'
import { enforcePipelineScope } from './_lib/scope-enforcer'
import { isMockMode } from '@/src/utils/mock-api'
import { buildMetricsFixture, parseScenario } from '../_mock/fixtures'

type Params = { params: Promise<{ id: string }> }

function getVmBase(): string {
  return process.env.VICTORIA_METRICS_URL ?? 'http://victoriametrics:8428'
}

/**
 * GET /ui-api/pipelines/:id/metrics
 *
 * Server-scope-enforced VictoriaMetrics proxy. Every PromQL query — whether the
 * UI sends a canonical key or a free-form `rawQuery` — is rewritten to inject
 * `{pipeline_id="<id>"}` before being forwarded to VM. See master plan § D5.
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const url = new URL(req.url)
  const queryName = url.searchParams.get('query') ?? ''
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const step = url.searchParams.get('step') ?? '15s'
  const rawQuery = url.searchParams.get('rawQuery')

  // Mock-mode short-circuit — keeps shape parity with the real VM proxy.
  // `?mock=populated|empty|retention|error` switches scenarios per-tab.
  if (isMockMode()) {
    if (!rawQuery && !isCanonicalKey(queryName)) {
      return NextResponse.json({ error: `unknown canonical query: ${queryName}` }, { status: 400 })
    }
    const scenario = parseScenario(url.searchParams.get('mock'))
    if (scenario === 'error') {
      return NextResponse.json({ error: 'VM 503 (mock)' }, { status: 503 })
    }
    return NextResponse.json(
      buildMetricsFixture({
        pipelineId: id,
        queryName,
        rawQuery,
        fromMs: from ? Number(from) : Date.now() - 3_600_000,
        toMs: to ? Number(to) : Date.now(),
        step,
        scenario,
      }),
    )
  }

  let promql: string
  try {
    if (rawQuery) {
      // Free-form: still scope-enforced.
      promql = enforcePipelineScope(rawQuery, id)
    } else if (isCanonicalKey(queryName)) {
      promql = enforcePipelineScope(CANONICAL_QUERIES[queryName], id)
    } else {
      return NextResponse.json({ error: `unknown canonical query: ${queryName}` }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'invalid query' }, { status: 400 })
  }

  const fromSec = from ? Math.floor(Number(from) / 1000) : Math.floor(Date.now() / 1000) - 3600
  const toSec = to ? Math.floor(Number(to) / 1000) : Math.floor(Date.now() / 1000)

  const vmUrl = new URL(`${getVmBase()}/api/v1/query_range`)
  vmUrl.searchParams.set('query', promql)
  vmUrl.searchParams.set('start', String(fromSec))
  vmUrl.searchParams.set('end', String(toSec))
  vmUrl.searchParams.set('step', step)

  try {
    const res = await fetch(vmUrl.toString(), { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: `VM ${res.status}` }, { status: 503 })
    }
    const json = await res.json()
    return NextResponse.json({
      promql,
      query: queryName || 'raw',
      result: json.data,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 503 })
  }
}
