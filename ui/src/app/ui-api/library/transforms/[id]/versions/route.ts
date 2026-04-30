import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { transforms, transformVersions } from '@/src/lib/db/schema'
import { PublishTransformVersionInput } from '@/src/lib/db/validations'
import { computeNextSemver } from '../../../schemas/[id]/versions/semver-util'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const rows = await db
    .select()
    .from(transformVersions)
    .where(eq(transformVersions.transformId, id))
    .orderBy(desc(transformVersions.createdAt))
  return NextResponse.json(rows)
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const parsed = PublishTransformVersionInput.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [parent] = await db.select().from(transforms).where(eq(transforms.id, id)).limit(1)
  if (!parent) return NextResponse.json({ error: 'Transform not found' }, { status: 404 })

  const [latest] = await db
    .select()
    .from(transformVersions)
    .where(eq(transformVersions.transformId, id))
    .orderBy(desc(transformVersions.createdAt))
    .limit(1)

  const nextVersion = computeNextSemver(latest?.version ?? null, parsed.data.bump)

  const [created] = await db
    .insert(transformVersions)
    .values({
      transformId: id,
      version: nextVersion,
      language: parsed.data.language,
      code: parsed.data.code,
      inputSchemaId: parsed.data.inputSchemaId ?? null,
      outputSchemaId: parsed.data.outputSchemaId ?? null,
      changeSummary: parsed.data.changeSummary ?? null,
    })
    .returning()

  // Sync live row to latest
  await db
    .update(transforms)
    .set({
      language: parsed.data.language,
      code: parsed.data.code,
      inputSchemaId: parsed.data.inputSchemaId ?? null,
      outputSchemaId: parsed.data.outputSchemaId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(transforms.id, id))

  return NextResponse.json(created, { status: 201 })
}
