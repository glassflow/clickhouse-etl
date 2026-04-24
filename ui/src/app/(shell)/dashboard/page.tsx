import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { DashboardClient } from './DashboardClient'
import type { ListPipelineConfig } from '@/src/types/pipeline'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Server-side pipeline fetch for SSR dashboard.
 * Calls the backend directly (same pattern as the redirect check in the root page.tsx).
 */
async function fetchPipelinesSSR(): Promise<ListPipelineConfig[]> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_IN_DOCKER === 'true' ? 'http://ui:8080' : 'http://localhost:8080'
    const res = await fetch(`${baseUrl}/ui-api/pipeline`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    if (data?.success && Array.isArray(data.pipelines)) {
      return data.pipelines as ListPipelineConfig[]
    }
    return []
  } catch {
    return []
  }
}

export default async function DashboardPage() {
  const authEnabled = isAuthEnabled()

  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) {
      redirect('/')
    }
  }

  const pipelines = await fetchPipelinesSSR()

  const stats = {
    total: pipelines.length,
    running: pipelines.filter((p) => {
      const s = (p.status as string | undefined)?.toLowerCase()
      return s === 'running' || s === 'active'
    }).length,
    error: pipelines.filter((p) => {
      const s = (p.status as string | undefined)?.toLowerCase()
      return s === 'error' || s === 'failed'
    }).length,
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--color-foreground-primary)]" />
          <p className="body-3 text-[var(--color-foreground-neutral-faded)]">Loading dashboard…</p>
        </div>
      }
    >
      <DashboardClient initialPipelines={pipelines} stats={stats} />
    </Suspense>
  )
}
