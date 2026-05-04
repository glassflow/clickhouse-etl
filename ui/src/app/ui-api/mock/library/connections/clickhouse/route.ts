import { NextResponse } from 'next/server'
import { listClickhouseConnections, createClickhouseConnection } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listClickhouseConnections())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.name || !body.config) {
      return NextResponse.json({ error: 'name and config are required' }, { status: 400 })
    }
    const conn = createClickhouseConnection({
      name: body.name,
      description: body.description ?? null,
      folderId: body.folderId ?? null,
      tags: body.tags ?? [],
      config: body.config,
    })
    return NextResponse.json(conn, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create ClickHouse connection' }, { status: 500 })
  }
}
