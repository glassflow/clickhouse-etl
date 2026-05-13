import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { ObservabilityCommandCenter } from '@/src/modules/observability/ObservabilityCommandCenter'

export default async function ObservabilityPage() {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  return (
    <Suspense fallback={<div className="caption-1 text-[var(--text-secondary)] p-6">Loading…</div>}>
      <ObservabilityCommandCenter />
    </Suspense>
  )
}
