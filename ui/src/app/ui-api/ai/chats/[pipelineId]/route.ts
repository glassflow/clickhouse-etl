// Per-scope chat persistence — GET to hydrate, PUT to write.
//
// Convention: the path segment is `'global'` for the new-pipeline chat or a
// real pipeline_id for the per-pipeline chat. We store one row per
// `scope_key` and upsert via an in-route check (UNIQUE on scope_key). PUT is
// debounced from the drawer (~500ms) so we expect frequent overwrites.

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { aiChats } from '@/src/lib/db/schema'

type Params = { params: Promise<{ pipelineId: string }> }

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { pipelineId } = await params
  const key = pipelineId === 'global' ? 'global' : pipelineId
  const [row] = await db.select().from(aiChats).where(eq(aiChats.scopeKey, key)).limit(1)
  // Empty placeholder when no row exists yet — drawer treats this as "fresh".
  return NextResponse.json(row ?? { messages: [], modelId: null, tokensUsed: 0 })
}

export async function PUT(req: Request, { params }: Params): Promise<NextResponse> {
  const { pipelineId } = await params
  const key = pipelineId === 'global' ? 'global' : pipelineId
  const body = (await req.json().catch(() => ({}))) as {
    messages?: unknown[]
    modelId?: string
    tokensUsed?: number
  }

  const [existing] = await db
    .select()
    .from(aiChats)
    .where(eq(aiChats.scopeKey, key))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(aiChats)
      .set({
        messages: body.messages ?? [],
        modelId: body.modelId ?? existing.modelId,
        tokensUsed: body.tokensUsed ?? existing.tokensUsed,
        updatedAt: new Date(),
      })
      .where(eq(aiChats.scopeKey, key))
      .returning()
    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(aiChats)
    .values({
      scopeKey: key,
      pipelineId: key === 'global' ? null : pipelineId,
      messages: body.messages ?? [],
      modelId: body.modelId ?? 'claude-haiku-4-5',
      tokensUsed: body.tokensUsed ?? 0,
    })
    .returning()
  return NextResponse.json(created, { status: 201 })
}
