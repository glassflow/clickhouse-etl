import { NextResponse } from 'next/server'
import { listFilterConfigs } from '@/src/app/ui-api/mock/data/library-state'

export async function GET() {
  return NextResponse.json(listFilterConfigs())
}
