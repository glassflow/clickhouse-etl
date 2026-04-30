import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { transforms } from '@/src/lib/db/schema'
import { UpdateTransformInput } from '@/src/lib/db/validations'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const [row] = await db.select().from(transforms).where(eq(transforms.id, id)).limit(1)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const parsed = UpdateTransformInput.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const [updated] = await db
    .update(transforms)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(transforms.id, id))
    .returning()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const result = await db
    .delete(transforms)
    .where(eq(transforms.id, id))
    .returning({ id: transforms.id })
  if (result.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: id })
}
