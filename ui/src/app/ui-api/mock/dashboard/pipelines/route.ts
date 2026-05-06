import { NextResponse } from 'next/server'
import { getDashboardScenario } from '../../data/dashboard'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { pipelines } = getDashboardScenario(searchParams.get('scenario'))
  return NextResponse.json({ pipelines })
}
