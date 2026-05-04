import { NextResponse } from 'next/server'
import { listFolders, createFolder } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listFolders())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const folder = createFolder({ name: body.name, parentId: body.parentId ?? null })
    return NextResponse.json(folder, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
  }
}
