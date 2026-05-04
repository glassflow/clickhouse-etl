import { NextResponse } from 'next/server'
import { getKafkaConnectionUsedBy } from '@/src/app/ui-api/mock/data/library-state'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  return NextResponse.json({ usedBy: getKafkaConnectionUsedBy(id) })
}
