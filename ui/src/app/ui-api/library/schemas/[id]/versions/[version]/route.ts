import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { schemaVersions } from '@/src/lib/db/schema'

type Params = { params: Promise<{ id: string; version: string }> }

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id, version } = await params
  const [row] = await db
    .select()
    .from(schemaVersions)
    .where(and(eq(schemaVersions.schemaId, id), eq(schemaVersions.version, version)))
    .limit(1)

  if (!row) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  return NextResponse.json(row)
}
