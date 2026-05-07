import { NextResponse } from 'next/server'
import { getDedupConfig, updateDedupConfig, deleteDedupConfig } from '@/src/app/ui-api/mock/data/library-state'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const item = getDedupConfig(id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const patch = await req.json()
  const updated = updateDedupConfig(id, patch)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const deleted = deleteDedupConfig(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
