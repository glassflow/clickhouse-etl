import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { ObservabilityLandingClient } from '@/src/modules/observability/ObservabilityLandingClient'

export default async function ObservabilityPage() {
  const authEnabled = isAuthEnabled()

  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) {
      redirect('/')
    }
  }

  return (
    <Suspense fallback={<div className="caption-1 text-[var(--text-secondary)] p-6">Loading…</div>}>
      <ObservabilityLandingClient />
    </Suspense>
  )
}
