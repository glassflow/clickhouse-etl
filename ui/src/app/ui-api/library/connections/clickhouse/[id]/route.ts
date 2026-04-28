import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { clickhouseConnections } from '@/src/lib/db/schema'
import { UpdateClickhouseConnectionInput } from '@/src/lib/db/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

type ClickhouseUpdate = Partial<typeof clickhouseConnections.$inferInsert>

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    const [row] = await db
      .select()
      .from(clickhouseConnections)
      .where(eq(clickhouseConnections.id, id))
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
    const parsed = UpdateClickhouseConnectionInput.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const [updated] = await db
      .update(clickhouseConnections)
      .set({ ...(parsed.data as unknown as ClickhouseUpdate), updatedAt: new Date() })
      .where(eq(clickhouseConnections.id, id))
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
    const [deleted] = await db
      .delete(clickhouseConnections)
      .where(eq(clickhouseConnections.id, id))
      .returning()
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 },
    )
  }
}
