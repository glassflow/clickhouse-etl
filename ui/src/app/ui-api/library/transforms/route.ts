import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { transforms } from '@/src/lib/db/schema'
import { CreateTransformInput } from '@/src/lib/db/validations'

type TransformInsert = typeof transforms.$inferInsert

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db.select().from(transforms).orderBy(asc(transforms.createdAt))
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = CreateTransformInput.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const [created] = await db
      .insert(transforms)
      .values(parsed.data as unknown as TransformInsert)
      .returning()
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
