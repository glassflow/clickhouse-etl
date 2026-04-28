import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { CanvasView } from '@/src/modules/canvas/CanvasView'
import { CanvasDeployButton } from '@/src/modules/canvas/CanvasDeployButton'

export default async function CanvasPage() {
  const authEnabled = isAuthEnabled()

  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) {
      redirect('/')
    }
  }

  return (
    <div className="flex flex-col h-full gap-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h1 className="title-3 text-[var(--text-primary)]">Pipeline Canvas</h1>
        <CanvasDeployButton />
      </div>
      <div className="flex-1 min-h-0">
        <CanvasView />
      </div>
    </div>
  )
}
