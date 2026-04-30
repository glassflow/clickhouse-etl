import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { schemas, schemaVersions } from '@/src/lib/db/schema'
import { PublishSchemaVersionInput } from '@/src/lib/db/validations'
import { computeNextSemver } from './semver-util'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  try {
    const rows = await db
      .select()
      .from(schemaVersions)
      .where(eq(schemaVersions.schemaId, id))
      .orderBy(desc(schemaVersions.createdAt))
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params

  const parsed = PublishSchemaVersionInput.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const [parent] = await db.select().from(schemas).where(eq(schemas.id, id))
    if (!parent) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    }

    const [latest] = await db
      .select()
      .from(schemaVersions)
      .where(eq(schemaVersions.schemaId, id))
      .orderBy(desc(schemaVersions.createdAt))
      .limit(1)

    const nextVersion = computeNextSemver(latest?.version ?? null, parsed.data.bump)

    const [created] = await db
      .insert(schemaVersions)
      .values({
        schemaId: id,
        version: nextVersion,
        fields: parsed.data.fields,
        changeSummary: parsed.data.changeSummary ?? null,
      })
      .returning()

    // Update the live schema's fields to match the latest version
    await db
      .update(schemas)
      .set({ fields: parsed.data.fields, updatedAt: new Date() })
      .where(eq(schemas.id, id))

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
