/**
 * Used-by adapters for Library resource detail pages.
 *
 * Phase 3 onwards: queries `pipeline_references` directly. A reference row is
 * created every time Canvas writes a new pipeline_revisions entry, so the
 * latest reference per (pipeline_id, resource) reflects what version that
 * pipeline currently has pinned (or live, for connections).
 *
 * Phase 1 used a config-heuristic that scanned the live backend pipeline list.
 * That heuristic is gone — Phase 3 owns this lookup authoritatively.
 *
 * Pipeline names are best-effort hydrated from the existing `getPipelines`
 * call so the UI can show human-readable rows; on failure we fall back to
 * `pipelineId` as the display name.
 */

import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { pipelineReferences, type PipelineResourceKind } from '@/src/lib/db/schema'
import { getPipelines } from '@/src/api/pipeline-api'
import type { ListPipelineConfig } from '@/src/types/pipeline'

export type UsedByEntry = {
  pipelineId: string
  pipelineName: string
  pinnedVersion?: string
  health: 'ok' | 'warn' | 'err'
  status: 'active' | 'stopped'
  drift: boolean
}

export async function findPipelinesUsingKafkaConnection(
  connectionId: string,
): Promise<UsedByEntry[]> {
  return findPipelinesByResource('kafka_connection', connectionId)
}

export async function findPipelinesUsingClickhouseConnection(
  connectionId: string,
): Promise<UsedByEntry[]> {
  return findPipelinesByResource('clickhouse_connection', connectionId)
}

export async function findPipelinesUsingSchema(schemaId: string): Promise<UsedByEntry[]> {
  return findPipelinesByResource('schema', schemaId)
}

export async function findPipelinesUsingTransform(transformId: string): Promise<UsedByEntry[]> {
  return findPipelinesByResource('transform', transformId)
}

async function findPipelinesByResource(
  kind: PipelineResourceKind,
  resourceId: string,
): Promise<UsedByEntry[]> {
  // Fetch all references for this resource newest-first, then collapse to the
  // most-recent entry per pipelineId in-app. This stays portable between
  // Postgres and the SQLite dev fallback (which lacks `selectDistinctOn`).
  const rows = await db
    .select({
      pipelineId: pipelineReferences.pipelineId,
      pinnedVersion: pipelineReferences.pinnedVersion,
      createdAt: pipelineReferences.createdAt,
    })
    .from(pipelineReferences)
    .where(
      and(
        eq(pipelineReferences.resourceKind, kind),
        eq(pipelineReferences.resourceId, resourceId),
      ),
    )
    .orderBy(desc(pipelineReferences.createdAt))

  const seen = new Map<string, { pinnedVersion: string | null }>()
  for (const row of rows) {
    if (!seen.has(row.pipelineId)) {
      seen.set(row.pipelineId, { pinnedVersion: row.pinnedVersion })
    }
  }

  if (seen.size === 0) return []

  // Best-effort name resolution. If the backend list is unavailable we still
  // return the rows keyed by pipeline_id — the UI uses pipelineName as a
  // display label only, the id remains the link target.
  let nameById = new Map<string, string>()
  try {
    const pipelines: ListPipelineConfig[] = await getPipelines()
    nameById = new Map(pipelines.map((p) => [p.pipeline_id, p.name ?? p.pipeline_id]))
  } catch {
    // intentional: keep nameById empty, fall through to id-as-name
  }

  return Array.from(seen.entries()).map(([pipelineId, info]) => ({
    pipelineId,
    pipelineName: nameById.get(pipelineId) ?? pipelineId,
    pinnedVersion: info.pinnedVersion ?? undefined,
    health: 'ok' as const,
    status: 'active' as const,
    drift: false,
  }))
}
