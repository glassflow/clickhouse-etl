import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { Crumbs } from '@/src/components/ui/crumbs'
import { StackAdminPanel } from '@/src/modules/observability/StackAdminPanel'

export default async function WorkspaceObservabilityPage() {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <Crumbs
        crumbs={[
          { label: 'Workspace', href: '/workspace/observability' },
          { label: 'Observability' },
        ]}
      />
      <div className="flex flex-col gap-1">
        <h1 className="title-2 text-[var(--text-primary)]">Observability stack</h1>
        <p className="body-3 text-[var(--text-secondary)]">
          Internal metrics + logs versions, retention, fan-out, and cardinality.
        </p>
      </div>
      <StackAdminPanel />
    </div>
  )
}
