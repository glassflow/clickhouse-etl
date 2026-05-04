import { NextResponse } from 'next/server'
import { listTransformVersions, publishTransformVersion } from '@/src/app/ui-api/mock/data/library-state'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  return NextResponse.json(listTransformVersions(id))
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    if (!body.bump || !body.language || !body.code) {
      return NextResponse.json({ error: 'bump, language and code are required' }, { status: 400 })
    }
    const version = publishTransformVersion(id, {
      bump: body.bump,
      language: body.language,
      code: body.code,
      inputSchemaId: body.inputSchemaId ?? null,
      outputSchemaId: body.outputSchemaId ?? null,
      changeSummary: body.changeSummary,
    })
    if (!version) return NextResponse.json({ error: 'Transform not found' }, { status: 404 })
    return NextResponse.json(version, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to publish transform version' }, { status: 500 })
  }
}
