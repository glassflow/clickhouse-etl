import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { pipelineRevisions, pipelineReferences } from '@/src/lib/db/schema'

type Params = { params: Promise<{ id: string; revision: string }> }

/**
 * GET /ui-api/pipelines/:id/revisions/:revision
 *
 * Returns a single revision with its full config snapshot and all of its
 * pipeline_references rows. Used by the upgrade modal + canvas to view a
 * historical revision's resource pins.
 */
export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id, revision } = await params
  const rev = Number(revision)
  if (!Number.isFinite(rev)) {
    return NextResponse.json({ error: 'Invalid revision number' }, { status: 400 })
  }

  const [row] = await db
    .select()
    .from(pipelineRevisions)
    .where(and(eq(pipelineRevisions.pipelineId, id), eq(pipelineRevisions.revision, rev)))
    .limit(1)

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const refs = await db
    .select()
    .from(pipelineReferences)
    .where(eq(pipelineReferences.revisionId, row.id))

  return NextResponse.json({ ...row, references: refs })
}
