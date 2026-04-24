import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { kafkaConnections } from '@/src/lib/db/schema'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    const [row] = await db.select().from(kafkaConnections).where(eq(kafkaConnections.id, id))
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(row)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    const body = await request.json()
    const [updated] = await db
      .update(kafkaConnections)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(kafkaConnections.id, id))
      .returning()
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    await db.delete(kafkaConnections).where(eq(kafkaConnections.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}
