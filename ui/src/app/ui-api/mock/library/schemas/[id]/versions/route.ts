import { NextResponse } from 'next/server'
import { listSchemaVersions, publishSchemaVersion } from '@/src/app/ui-api/mock/data/library-state'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  return NextResponse.json(listSchemaVersions(id))
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    if (!body.bump || !body.fields) {
      return NextResponse.json({ error: 'bump and fields are required' }, { status: 400 })
    }
    const version = publishSchemaVersion(id, {
      bump: body.bump,
      fields: body.fields,
      changeSummary: body.changeSummary,
    })
    if (!version) return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    return NextResponse.json(version, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to publish schema version' }, { status: 500 })
  }
}
