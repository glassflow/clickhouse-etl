import { redirect } from 'next/navigation'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { CanvasView } from '@/src/modules/canvas/CanvasView'

export default async function CanvasPage() {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }
  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-fadeIn">
      <CanvasView pipelineId={null} currentRevision={null} />
    </div>
  )
}
