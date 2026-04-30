import { NextResponse } from 'next/server'
import { desc, eq, max } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { pipelineRevisions, pipelineReferences } from '@/src/lib/db/schema'
import { CreateRevisionInput } from '@/src/lib/db/validations'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /ui-api/pipelines/:id/revisions
 *
 * Lists all revisions for a pipeline, newest first. Each revision row
 * includes its full config snapshot — references are queried separately
 * via the single-revision route to keep the list response light.
 */
export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const rows = await db
    .select()
    .from(pipelineRevisions)
    .where(eq(pipelineRevisions.pipelineId, id))
    .orderBy(desc(pipelineRevisions.revision))
  return NextResponse.json(rows)
}

/**
 * POST /ui-api/pipelines/:id/revisions
 *
 * Creates a new revision (revision = max+1) and atomically inserts the
 * provided pipeline_references rows in a single transaction.
 *
 * Note: this only writes the UI-side bookkeeping row. The actual backend
 * pipeline deploy is wired separately by the Canvas DeployBar
 * (`serializeAndDeploy` in CanvasView). See plan task 3.10 notes.
 */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateRevisionInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Compute next revision = max(revision) + 1 for this pipelineId.
  const [latest] = await db
    .select({ max: max(pipelineRevisions.revision) })
    .from(pipelineRevisions)
    .where(eq(pipelineRevisions.pipelineId, id))
  const nextRev = (latest?.max ?? 0) + 1

  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(pipelineRevisions)
      .values({
        pipelineId: id,
        revision: nextRev,
        config: parsed.data.config,
        env: parsed.data.env,
      })
      .returning()

    if (parsed.data.references.length > 0) {
      await tx.insert(pipelineReferences).values(
        parsed.data.references.map((r) => ({
          revisionId: created.id,
          pipelineId: id,
          resourceKind: r.resourceKind,
          resourceId: r.resourceId,
          pinnedVersion: r.pinnedVersion ?? null,
        })),
      )
    }
    return created
  })

  return NextResponse.json(
    { pipelineId: id, revision: result.revision, revisionId: result.id },
    { status: 201 },
  )
}
