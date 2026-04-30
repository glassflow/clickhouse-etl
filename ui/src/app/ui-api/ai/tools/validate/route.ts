// Tool: validate
//
// Stateless wrapper around the canvas validator — given a `nodes`/`edges`/
// `configs` triple, returns the same `ValidationResult` shape Canvas displays
// at edit time. The drawer's `ValidateCard` renders just the summary line.

import { NextResponse } from 'next/server'
import { validateCanvas } from '@/src/modules/canvas/canvas-validation'

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as {
    nodes?: unknown[]
    edges?: unknown[]
    configs?: Record<string, Record<string, unknown>>
  }
  const result = validateCanvas(
    // The validator is permissive — node/edge shapes are checked at runtime
    // via `n.type` / `e.source` lookups. The cast keeps the caller from
    // having to import xyflow types.
    (body.nodes ?? []) as Parameters<typeof validateCanvas>[0],
    (body.edges ?? []) as Parameters<typeof validateCanvas>[1],
    body.configs ?? {},
  )
  return NextResponse.json(result)
}
