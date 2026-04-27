import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { clickhouseConnections } from '@/src/lib/db/schema'
import { CreateClickhouseConnectionInput } from '@/src/lib/db/validations'

type ClickhouseInsert = typeof clickhouseConnections.$inferInsert

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db
      .select()
      .from(clickhouseConnections)
      .orderBy(asc(clickhouseConnections.createdAt))
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
    const parsed = CreateClickhouseConnectionInput.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const [created] = await db
      .insert(clickhouseConnections)
      .values(parsed.data as unknown as ClickhouseInsert)
      .returning()
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}
