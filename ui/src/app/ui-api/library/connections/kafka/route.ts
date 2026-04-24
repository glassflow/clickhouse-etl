import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { kafkaConnections } from '@/src/lib/db/schema'

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
    const body = await request.json()
    const [created] = await db.insert(kafkaConnections).values(body).returning()
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}
