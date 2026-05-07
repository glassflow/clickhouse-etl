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
      source: body.source ?? 'manual',
      registryUrl: body.registryUrl ?? null,
      fields: body.fields,
      fieldCount: body.fields?.length ?? 0,
      pipelineCount: 0,
      latestVersion: null,
      hasDrift: false,
      usedByCount: 0,
    })
    return NextResponse.json(schema, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create schema' }, { status: 500 })
  }
}
