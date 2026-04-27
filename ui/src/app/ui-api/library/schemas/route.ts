import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { schemas } from '@/src/lib/db/schema'
import { CreateSchemaInput } from '@/src/lib/db/validations'

type SchemaInsert = typeof schemas.$inferInsert

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db.select().from(schemas).orderBy(asc(schemas.createdAt))
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = CreateSchemaInput.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const [created] = await db
      .insert(schemas)
      .values(parsed.data as unknown as SchemaInsert)
      .returning()
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}
