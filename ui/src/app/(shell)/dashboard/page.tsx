import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { getApiUrl } from '@/src/utils/mock-api'
import { determineDashboardState } from '@/src/modules/dashboard/types'
import type { DashPipeline, DashStats, Incident, ActivityItem } from '@/src/modules/dashboard/types'
import { DashboardClient } from './DashboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function fetchDashboardStats(scenario: string | null): Promise<{
  stats: DashStats
  incidents: Incident[]
  activity: ActivityItem[]
}> {
  try {
    const qs = scenario ? `?scenario=${scenario}` : ''
    const res = await fetch(getApiUrl(`dashboard/stats${qs}`), { cache: 'no-store' })
    if (!res.ok) throw new Error('stats fetch failed')
    return await res.json()
  } catch {
    return {
      stats: {
        activePipelines: 0, totalPipelines: 0,
        eventsPerSec: 0, eventsPerSecDelta: 0,
        errorRate: 0, errorRateDelta: 0,
        dlqEvents: 0, dlqDelta: 0,
        avgLagMs: 0, avgLagMsDelta: 0,
        throughputIn: 0, throughputOut: 0, throughputLossPct: 0,
        throughputSeries: { in: [], out: [] },
      },
      incidents: [],
      activity: [],
    }
  }
}

async function fetchDashboardPipelines(scenario: string | null): Promise<DashPipeline[]> {
  try {
    const qs = scenario ? `?scenario=${scenario}` : ''
    const res = await fetch(getApiUrl(`dashboard/pipelines${qs}`), { cache: 'no-store' })
    if (!res.ok) throw new Error('pipelines fetch failed')
    const data = await res.json()
    return data.pipelines ?? []
  } catch {
    return []
  }
}

type Props = { searchParams?: Promise<Record<string, string>> }

export default async function DashboardPage({ searchParams }: Props) {
  const authEnabled = isAuthEnabled()
  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const params = await (searchParams ?? Promise.resolve({} as Record<string, string>))
  const scenario = params.scenario ?? null

  const [{ stats, incidents, activity }, pipelines] = await Promise.all([
    fetchDashboardStats(scenario),
    fetchDashboardPipelines(scenario),
  ])

  const state = determineDashboardState(pipelines, incidents, stats, activity)

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--color-foreground-primary)]" />
          <p className="body-3 text-[var(--color-foreground-neutral-faded)]">Loading dashboard…</p>
        </div>
      }
    >
      <DashboardClient state={state} />
    </Suspense>
  )
}
