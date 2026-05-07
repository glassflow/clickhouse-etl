import { NextResponse } from 'next/server'
import { listDedupConfigs } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listDedupConfigs())
}
