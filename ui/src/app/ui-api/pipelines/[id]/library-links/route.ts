import { NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import semver from 'semver'
import { db } from '@/src/lib/db'
import {
  pipelineRevisions,
  pipelineReferences,
  schemas,
  schemaVersions,
  transforms,
  transformVersions,
  kafkaConnections,
  clickhouseConnections,
} from '@/src/lib/db/schema'

type Params = { params: Promise<{ id: string }> }

export type DriftLevel = 'none' | 'patch' | 'minor' | 'major'

export type LibraryLink = {
  resourceKind: 'kafka_connection' | 'clickhouse_connection' | 'schema' | 'transform'
  resourceId: string
  resourceName: string | null
  pinnedVersion: string | null // null = live (connections)
  latestVersion: string | null
  drift: DriftLevel
  lastUpgradedAt: string | null
}

/**
 * GET /ui-api/pipelines/:id/library-links
 *
 * Returns the references on the pipeline's *latest* revision joined against
 * each resource's name and (for schemas/transforms) the latest published
 * version, with a computed `drift` level per row.
 *
 * Drift semantics:
 *   - connections: never drift (always live)
 *   - schemas/transforms: compare pinned semver vs latest published semver
 */
export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params

  const [latestRev] = await db
    .select()
    .from(pipelineRevisions)
    .where(eq(pipelineRevisions.pipelineId, id))
    .orderBy(desc(pipelineRevisions.revision))
    .limit(1)

  if (!latestRev) return NextResponse.json({ links: [], revision: null })

  const refs = await db
    .select()
    .from(pipelineReferences)
    .where(eq(pipelineReferences.revisionId, latestRev.id))

  if (refs.length === 0) {
    return NextResponse.json({ links: [], revision: latestRev.revision })
  }

  const schemaIds = refs.filter((r) => r.resourceKind === 'schema').map((r) => r.resourceId)
  const transformIds = refs.filter((r) => r.resourceKind === 'transform').map((r) => r.resourceId)
  const kafkaIds = refs
    .filter((r) => r.resourceKind === 'kafka_connection')
    .map((r) => r.resourceId)
  const chIds = refs
    .filter((r) => r.resourceKind === 'clickhouse_connection')
    .map((r) => r.resourceId)

  const [schemaRows, transformRows, kafkaRows, chRows] = await Promise.all([
    schemaIds.length
      ? db.select({ id: schemas.id, name: schemas.name }).from(schemas).where(inArray(schemas.id, schemaIds))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    transformIds.length
      ? db
          .select({ id: transforms.id, name: transforms.name })
          .from(transforms)
          .where(inArray(transforms.id, transformIds))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    kafkaIds.length
      ? db
          .select({ id: kafkaConnections.id, name: kafkaConnections.name })
          .from(kafkaConnections)
          .where(inArray(kafkaConnections.id, kafkaIds))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    chIds.length
      ? db
          .select({ id: clickhouseConnections.id, name: clickhouseConnections.name })
          .from(clickhouseConnections)
          .where(inArray(clickhouseConnections.id, chIds))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ])

  const nameById = new Map<string, string>()
  for (const r of schemaRows) nameById.set(r.id, r.name)
  for (const r of transformRows) nameById.set(r.id, r.name)
  for (const r of kafkaRows) nameById.set(r.id, r.name)
  for (const r of chRows) nameById.set(r.id, r.name)

  // Latest version per schema. Fetch all versions for the referenced schemas
  // ordered newest-first; first row per schemaId is the latest. Done in-app to
  // stay portable across Postgres and the SQLite dev fallback.
  const latestSchemaByMap = new Map<string, { version: string; createdAt: Date }>()
  if (schemaIds.length) {
    const rows = await db
      .select({
        schemaId: schemaVersions.schemaId,
        version: schemaVersions.version,
        createdAt: schemaVersions.createdAt,
      })
      .from(schemaVersions)
      .where(inArray(schemaVersions.schemaId, schemaIds))
      .orderBy(desc(schemaVersions.createdAt))
    for (const v of rows) {
      if (!latestSchemaByMap.has(v.schemaId)) {
        latestSchemaByMap.set(v.schemaId, {
          version: v.version,
          createdAt: v.createdAt,
        })
      }
    }
  }

  const latestTxByMap = new Map<string, { version: string; createdAt: Date }>()
  if (transformIds.length) {
    const rows = await db
      .select({
        transformId: transformVersions.transformId,
        version: transformVersions.version,
        createdAt: transformVersions.createdAt,
      })
      .from(transformVersions)
      .where(inArray(transformVersions.transformId, transformIds))
      .orderBy(desc(transformVersions.createdAt))
    for (const v of rows) {
      if (!latestTxByMap.has(v.transformId)) {
        latestTxByMap.set(v.transformId, {
          version: v.version,
          createdAt: v.createdAt,
        })
      }
    }
  }

  const links: LibraryLink[] = refs.map((r) => {
    let latestVersion: string | null = null
    let lastUpgradedAt: string | null = null
    if (r.resourceKind === 'schema') {
      const latest = latestSchemaByMap.get(r.resourceId)
      latestVersion = latest?.version ?? null
      lastUpgradedAt = latest ? new Date(latest.createdAt).toISOString() : null
    } else if (r.resourceKind === 'transform') {
      const latest = latestTxByMap.get(r.resourceId)
      latestVersion = latest?.version ?? null
      lastUpgradedAt = latest ? new Date(latest.createdAt).toISOString() : null
    }

    const drift = computeDrift(r.pinnedVersion, latestVersion)

    return {
      resourceKind: r.resourceKind,
      resourceId: r.resourceId,
      resourceName: nameById.get(r.resourceId) ?? null,
      pinnedVersion: r.pinnedVersion ?? null,
      latestVersion,
      drift,
      lastUpgradedAt,
    }
  })

  return NextResponse.json({ links, revision: latestRev.revision })
}

function computeDrift(pinned: string | null, latest: string | null): DriftLevel {
  if (!pinned || !latest) return 'none'
  const p = semver.coerce(pinned)?.version
  const l = semver.coerce(latest)?.version
  if (!p || !l) return 'none'
  if (semver.eq(p, l)) return 'none'
  if (semver.major(l) > semver.major(p)) return 'major'
  if (semver.minor(l) > semver.minor(p)) return 'minor'
  return 'patch'
}
