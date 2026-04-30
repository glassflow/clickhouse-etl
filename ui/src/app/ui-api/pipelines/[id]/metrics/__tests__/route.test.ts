import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '../route'

function makeReq(qs: string): Request {
  return new Request(`http://localhost/ui-api/pipelines/p1/metrics${qs}`)
}

describe('GET /ui-api/pipelines/:id/metrics', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.VICTORIA_METRICS_URL = 'http://vm.test'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns 400 when query name is unknown', async () => {
    const res = await GET(makeReq('?query=does_not_exist'), {
      params: Promise.resolve({ id: 'p1' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unknown canonical query/)
  })

  it('returns 400 when no query and no rawQuery is supplied', async () => {
    const res = await GET(makeReq(''), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(400)
  })

  it('rewrites canonical query before forwarding to VM, including server-scope label', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ data: { resultType: 'matrix', result: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    global.fetch = fetchSpy as unknown as typeof fetch

    const res = await GET(makeReq('?query=records_ingested&from=1000&to=2000'), {
      params: Promise.resolve({ id: 'p1' }),
    })
    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const calledUrl = fetchSpy.mock.calls[0][0] as string
    // The forwarded URL must include the rewritten promql with pipeline_id="p1".
    expect(calledUrl).toContain('vm.test')
    expect(decodeURIComponent(calledUrl)).toContain('pipeline_id="p1"')

    const body = await res.json()
    expect(body.query).toBe('records_ingested')
    expect(body.promql).toContain('pipeline_id="p1"')
  })

  it('rewrites and accepts a rawQuery, overriding any forged pipeline_id', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ data: { resultType: 'matrix', result: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    global.fetch = fetchSpy as unknown as typeof fetch

    const res = await GET(
      makeReq(
        '?rawQuery=' +
          encodeURIComponent('glassflow_records_ingested_total{pipeline_id="other"}'),
      ),
      { params: Promise.resolve({ id: 'p1' }) },
    )
    expect(res.status).toBe(200)
    const calledUrl = fetchSpy.mock.calls[0][0] as string
    const decoded = decodeURIComponent(calledUrl)
    expect(decoded).toContain('pipeline_id="p1"')
    expect(decoded).not.toContain('pipeline_id="other"')
  })

  it('returns 400 when rawQuery is invalid (no metric)', async () => {
    const res = await GET(makeReq('?rawQuery=' + encodeURIComponent('1 + 1')), {
      params: Promise.resolve({ id: 'p1' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 503 when VM is unreachable', async () => {
    global.fetch = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const res = await GET(makeReq('?query=records_ingested'), {
      params: Promise.resolve({ id: 'p1' }),
    })
    expect(res.status).toBe(503)
  })

  it('returns 503 when VM responds non-2xx', async () => {
    global.fetch = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch

    const res = await GET(makeReq('?query=records_ingested'), {
      params: Promise.resolve({ id: 'p1' }),
    })
    expect(res.status).toBe(503)
  })
})
