import { NextResponse } from 'next/server'
import { listSchemas, createSchema } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listSchemas())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.name || !body.fields) {
      return NextResponse.json({ error: 'name and fields are required' }, { status: 400 })
    }
    const schema = createSchema({
      name: body.name,
      description: body.description ?? null,
      folderId: body.folderId ?? null,
      tags: body.tags ?? [],
      fields: body.fields,
    })
    return NextResponse.json(schema, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create schema' }, { status: 500 })
  }
}
