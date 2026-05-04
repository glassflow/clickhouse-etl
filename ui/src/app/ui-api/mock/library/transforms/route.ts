import { NextResponse } from 'next/server'
import { listTransforms, createTransform } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listTransforms())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.name || !body.language || !body.code) {
      return NextResponse.json({ error: 'name, language and code are required' }, { status: 400 })
    }
    const transform = createTransform({
      name: body.name,
      description: body.description ?? null,
      folderId: body.folderId ?? null,
      tags: body.tags ?? [],
      language: body.language,
      code: body.code,
      inputSchemaId: body.inputSchemaId ?? null,
      outputSchemaId: body.outputSchemaId ?? null,
    })
    return NextResponse.json(transform, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create transform' }, { status: 500 })
  }
}
