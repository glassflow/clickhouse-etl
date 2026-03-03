import { NextResponse } from 'next/server'

/**
 * Mock transformation expression evaluate endpoint
 * POST /ui-api/mock/transform/expression/evaluate
 *
 * Simulates the backend evaluate endpoint for testing in mock mode.
 * Returns 200 with a mock transformed body for valid-looking payloads,
 * 400 for invalid payloads.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (body?.type !== 'expr_lang_transform' || !body?.config?.transform) {
      return NextResponse.json(
        {
          status: 400,
          code: 'invalid_transformation_type',
          message: 'Invalid transformation type',
          details: { error: 'only expr_lang_transform is supported' },
        },
        { status: 400 },
      )
    }

    const transform = body.config.transform
    if (!Array.isArray(transform) || transform.length === 0) {
      return NextResponse.json(
        {
          status: 400,
          code: 'transformation_error',
          message: 'Failed to evaluate transformation',
          details: { error: 'no transform entries' },
        },
        { status: 400 },
      )
    }

    // Mock: build output using output_name as key; value from first field referenced in expression (e.g. upper(user_id) -> use sample.user_id)
    const sample = body.sample ?? {}
    const output: Record<string, unknown> = {}
    for (const t of transform) {
      const name = t?.output_name ?? 'unknown'
      const expression = typeof t?.expression === 'string' ? t.expression : ''
      // Extract a field reference from expression: (field_name) or plain field_name
      const parenMatch = expression.match(/\(([a-zA-Z_][a-zA-Z0-9_]*)\)/)
      const refField = parenMatch ? parenMatch[1] : expression.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)$/)?.[1]
      const value =
        refField && refField in sample ? sample[refField] : (sample[name] ?? null)
      output[name] = value
    }

    return NextResponse.json(output, { status: 200 })
  } catch {
    return NextResponse.json(
      {
        status: 500,
        code: 'internal_error',
        message: 'Failed to evaluate transformation expression',
        details: { error: 'Unknown error' },
      },
      { status: 500 },
    )
  }
}
