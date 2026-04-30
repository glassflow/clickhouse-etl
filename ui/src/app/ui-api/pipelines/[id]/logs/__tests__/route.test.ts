import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '../route'

function makeReq(qs: string): Request {
  return new Request(`http://localhost/ui-api/pipelines/p1/logs${qs}`)
}

describe('GET /ui-api/pipelines/:id/logs', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.VICTORIA_LOGS_URL = 'http://vl.test'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('rewrites the query before forwarding to VL, including server-scope label', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response('{"_time":"2026-04-30T00:00:00Z","_msg":"hello"}\n', {
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
      }),
    )
    global.fetch = fetchSpy as unknown as typeof fetch

    const res = await GET(makeReq('?query=severity:error&from=1000&to=2000'), {
      params: Promise.resolve({ id: 'p1' }),
    })

    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const calledUrl = String((fetchSpy.mock.calls[0] as unknown[])[0])
    expect(calledUrl).toContain('vl.test')
    const decoded = decodeURIComponent(calledUrl)
    expect(decoded).toContain('pipeline_id:"p1"')
    expect(decoded).toContain('severity:error')

    const body = await res.json()
    expect(body.query).toContain('pipeline_id:"p1"')
    expect(body.lines).toHaveLength(1)
    expect(body.count).toBe(1)
  })

  it('overrides a forged pipeline_id', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response('', { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
    )
    global.fetch = fetchSpy as unknown as typeof fetch

    await GET(
      makeReq(
        '?query=' + encodeURIComponent('pipeline_id:"other" severity:error'),
      ),
      { params: Promise.resolve({ id: 'p1' }) },
    )

    const calledUrl = String((fetchSpy.mock.calls[0] as unknown[])[0])
    const decoded = decodeURIComponent(calledUrl)
    expect(decoded).toContain('pipeline_id:"p1"')
    expect(decoded).not.toContain('pipeline_id:"other"')
  })

  it('handles empty query — still scoped', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response('', { status: 200 }),
    )
    global.fetch = fetchSpy as unknown as typeof fetch

    await GET(makeReq(''), { params: Promise.resolve({ id: 'p1' }) })

    const calledUrl = String((fetchSpy.mock.calls[0] as unknown[])[0])
    expect(decodeURIComponent(calledUrl)).toContain('pipeline_id:"p1"')
  })

  it('drops malformed NDJSON lines silently', async () => {
    global.fetch = (async () =>
      new Response(
        '{"_time":"a","_msg":"good"}\nnot json\n{"_time":"b","_msg":"good2"}\n',
        { status: 200 },
      )) as unknown as typeof fetch

    const res = await GET(makeReq('?query='), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lines).toHaveLength(2)
    expect(body.lines[0]._msg).toBe('good')
    expect(body.lines[1]._msg).toBe('good2')
  })

  it('returns 503 when VL is unreachable', async () => {
    global.fetch = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const res = await GET(makeReq('?query='), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(503)
  })

  it('returns 503 when VL responds non-2xx', async () => {
    global.fetch = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch

    const res = await GET(makeReq('?query='), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(503)
  })

  it('clamps limit to safe upper bound', async () => {
    const fetchSpy = vi.fn(async () => new Response('', { status: 200 }))
    global.fetch = fetchSpy as unknown as typeof fetch

    await GET(makeReq('?query=&limit=999999'), { params: Promise.resolve({ id: 'p1' }) })

    const calledUrl = String((fetchSpy.mock.calls[0] as unknown[])[0])
    expect(calledUrl).toContain('limit=5000')
  })
})
