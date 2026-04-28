import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { kafkaConnections } from '@/src/lib/db/schema'
import { CreateKafkaConnectionInput } from '@/src/lib/db/validations'

type KafkaInsert = typeof kafkaConnections.$inferInsert

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db.select().from(kafkaConnections).orderBy(asc(kafkaConnections.createdAt))
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
    const parsed = CreateKafkaConnectionInput.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const [created] = await db
      .insert(kafkaConnections)
      .values(parsed.data as unknown as KafkaInsert)
      .returning()
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}
