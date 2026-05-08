import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/src/lib/db'
import { pipelineRevisions } from '@/src/lib/db/schema'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { CanvasView } from '@/src/modules/canvas/CanvasView'
import type { InternalPipelineConfig } from '@/src/types/pipeline'

type PageProps = { searchParams: Promise<{ draft?: string }> }

export default async function CanvasPage({ searchParams }: PageProps) {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const { draft } = await searchParams
  let initialConfig: InternalPipelineConfig | null = null

  if (draft) {
    const [rev] = await db
      .select()
      .from(pipelineRevisions)
      .where(eq(pipelineRevisions.pipelineId, draft))
      .orderBy(desc(pipelineRevisions.revision))
      .limit(1)
    initialConfig = (rev?.config as unknown as InternalPipelineConfig) ?? null
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-fadeIn">
      <CanvasView pipelineId={null} currentRevision={null} initialConfig={initialConfig} />
    </div>
  )
}
