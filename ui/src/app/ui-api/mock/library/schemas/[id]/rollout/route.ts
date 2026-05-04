import { NextResponse } from 'next/server'
import { rolloutSchema } from '@/src/app/ui-api/mock/data/library-state'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    if (!body.targetPipelineIds || !body.toVersion) {
      return NextResponse.json({ error: 'targetPipelineIds and toVersion are required' }, { status: 400 })
    }
    const results = rolloutSchema(id, {
      targetPipelineIds: body.targetPipelineIds,
      toVersion: body.toVersion,
      mode: body.mode ?? 'atomic',
    })
    const succeeded = results.filter((r) => r.revision != null).length
    return NextResponse.json({ succeeded, total: body.targetPipelineIds.length, results })
  } catch {
    return NextResponse.json({ error: 'Rollout failed' }, { status: 500 })
  }
}
