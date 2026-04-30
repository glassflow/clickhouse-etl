// Tool: pipeline_draft
//
// Persists a draft pipeline as a fresh `pipeline_revisions` row (env='draft')
// plus its `pipeline_references`. The drawer card renders an "Open in canvas"
// CTA that points at `/canvas?draft=<id>`. Materialization into domain stores
// happens client-side when the user follows the link — the server side just
// records the draft.

import { NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import {
  pipelineRevisions,
  pipelineReferences,
  type PipelineResourceKind,
} from '@/src/lib/db/schema'

type DraftBody = {
  draftPipelineId?: string
  config: Record<string, unknown>
  references?: Array<{
    resourceKind: PipelineResourceKind
    resourceId: string
    pinnedVersion?: string
  }>
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as DraftBody | null
  if (!body || typeof body.config !== 'object' || body.config === null) {
    return NextResponse.json({ error: 'config is required' }, { status: 400 })
  }
  const draftId = body.draftPipelineId ?? `draft-${Date.now()}`

  await db.transaction(async (tx) => {
    const [rev] = await tx
      .insert(pipelineRevisions)
      .values({ pipelineId: draftId, revision: 0, env: 'draft', config: body.config })
      .returning()
    if (body.references?.length) {
      await tx.insert(pipelineReferences).values(
        body.references.map((r) => ({
          revisionId: rev.id,
          pipelineId: draftId,
          resourceKind: r.resourceKind,
          resourceId: r.resourceId,
          pinnedVersion: r.pinnedVersion ?? null,
        })),
      )
    }
  })

  return NextResponse.json({
    draftPipelineId: draftId,
    openInCanvasUrl: `/canvas?draft=${encodeURIComponent(draftId)}`,
  })
}
