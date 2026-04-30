import { NextResponse } from 'next/server'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { pipelineRevisions, pipelineReferences } from '@/src/lib/db/schema'

const Body = z.object({
  targetPipelineIds: z.array(z.string()).min(1),
  toVersion: z.string().min(1),
  mode: z.enum(['atomic', 'staged']).default('atomic'),
})

type Params = { params: Promise<{ id: string }> }

/**
 * POST /ui-api/library/schemas/:id/rollout
 *
 * Bulk-roll a schema to `toVersion` across the listed pipelines. For each
 * target pipeline:
 *   1. Read its latest revision (config + references).
 *   2. Build a new references list with the targeted schema's pinnedVersion
 *      bumped to toVersion (other refs unchanged, order preserved).
 *   3. In a single transaction, insert a new pipelineRevisions row at
 *      revision = max + 1 and the rebuilt pipelineReferences rows.
 *
 * Mode:
 *   - 'atomic'  — back-to-back per-pipeline transactions (each pipeline's
 *                  revision insert is atomic; the bulk run is sequential).
 *   - 'staged'  — sequential with a 500ms gap between pipelines, intended
 *                  for canary-style rollouts. Phase 8 may move to a queue.
 *
 * Per-pipeline failures are non-fatal: each pipeline's outcome appears in
 * the response `results[]` so the UI can render a partial-success state.
 */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const { id: schemaId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { targetPipelineIds, toVersion, mode } = parsed.data
  const results: Array<{ pipelineId: string; revision?: number; error?: string }> = []

  for (const pipelineId of targetPipelineIds) {
    try {
      const [latestRev] = await db
        .select()
        .from(pipelineRevisions)
        .where(eq(pipelineRevisions.pipelineId, pipelineId))
        .orderBy(desc(pipelineRevisions.revision))
        .limit(1)

      if (!latestRev) {
        results.push({ pipelineId, error: 'No revisions' })
        continue
      }

      const refs = await db
        .select()
        .from(pipelineReferences)
        .where(eq(pipelineReferences.revisionId, latestRev.id))

      const newRefs = refs.map((r) => ({
        resourceKind: r.resourceKind,
        resourceId: r.resourceId,
        pinnedVersion:
          r.resourceKind === 'schema' && r.resourceId === schemaId
            ? toVersion
            : r.pinnedVersion,
      }))

      const nextRev = latestRev.revision + 1
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(pipelineRevisions)
          .values({
            pipelineId,
            revision: nextRev,
            config: latestRev.config,
            env: latestRev.env,
          })
          .returning()
        if (newRefs.length > 0) {
          await tx.insert(pipelineReferences).values(
            newRefs.map((r) => ({
              revisionId: row.id,
              pipelineId,
              resourceKind: r.resourceKind,
              resourceId: r.resourceId,
              pinnedVersion: r.pinnedVersion ?? null,
            })),
          )
        }
        return row
      })

      results.push({ pipelineId, revision: created.revision })

      if (mode === 'staged') {
        await new Promise((r) => setTimeout(r, 500))
      }
    } catch (err) {
      results.push({
        pipelineId,
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  const succeeded = results.filter((r) => r.revision != null).length
  return NextResponse.json({ succeeded, total: targetPipelineIds.length, results })
}
