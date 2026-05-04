import { NextResponse } from 'next/server'
import { listKafkaConnections, createKafkaConnection } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listKafkaConnections())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.name || !body.config) {
      return NextResponse.json({ error: 'name and config are required' }, { status: 400 })
    }
    const conn = createKafkaConnection({
      name: body.name,
      description: body.description ?? null,
      folderId: body.folderId ?? null,
      tags: body.tags ?? [],
      config: body.config,
    })
    return NextResponse.json(conn, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create Kafka connection' }, { status: 500 })
  }
}
