import { NextResponse } from 'next/server'
import {
  getKafkaConnection,
  updateKafkaConnection,
  deleteKafkaConnection,
} from '@/src/app/ui-api/mock/data/library-state'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const conn = getKafkaConnection(id)
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(conn)
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const updated = updateKafkaConnection(id, body)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update Kafka connection' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const deleted = deleteKafkaConnection(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
