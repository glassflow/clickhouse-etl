import { NextResponse } from 'next/server'
import { getFilterConfig, updateFilterConfig, deleteFilterConfig } from '@/src/app/ui-api/mock/data/library-state'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const item = getFilterConfig(id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const patch = await req.json()
  const updated = updateFilterConfig(id, patch)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const deleted = deleteFilterConfig(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
