import { NextResponse } from 'next/server'
import { getDashboardScenario } from '../../data/dashboard'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { stats, incidents, activity } = getDashboardScenario(searchParams.get('scenario'))
  return NextResponse.json({ stats, incidents, activity })
}
