import { NextResponse } from 'next/server'
import { getSchemaVersion } from '@/src/app/ui-api/mock/data/library-state'

type Params = { params: Promise<{ id: string; version: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id, version } = await params
  const row = getSchemaVersion(id, version)
  if (!row) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  return NextResponse.json(row)
}
