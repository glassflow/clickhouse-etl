import { redirect, notFound } from 'next/navigation'
import { Suspense, cache } from 'react'
import { Loader2 } from 'lucide-react'
import type { Metadata } from 'next'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { getPipeline } from '@/src/api/pipeline-api'
import { PipelineHeader } from '@/src/modules/pipelines/[id]/PipelineHeader'
import { PipelineTabs } from '@/src/modules/pipelines/[id]/PipelineTabs'
import { getDriftCount } from '@/src/app/ui-api/pipelines/[id]/library-links/_lib'
import type { ApiError } from '@/src/types/pipeline'

const getCachedPipeline = cache(getPipeline)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  try {
    const pipeline = await getCachedPipeline(id)
    const name = pipeline?.name ?? pipeline?.pipeline_id ?? id
    return {
      title: `Pipeline: ${name}`,
      description: `View and manage pipeline ${name}.`,
    }
  } catch {
    return { title: 'Pipeline | Glassflow', description: 'Pipeline details' }
  }
}

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function PipelineLayout({ children, params }: LayoutProps) {
  if (isAuthEnabled()) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const { id } = await params
  let pipeline
  try {
    pipeline = await getCachedPipeline(id)
  } catch (err) {
    const apiError = err as ApiError
    if (apiError?.code === 404) notFound()
    // For other errors, render without header data — the child page will handle errors.
    pipeline = null
  }

  // Drift count is ambient UX. getDriftCount() swallows DB errors and returns 0
  // so a missing migration / unreachable DB never blanks the pipeline page.
  const driftCount = await getDriftCount(id)

  return (
    <div className="flex flex-col gap-5 animate-fadeIn max-w-[var(--max-content-width-2xl)] mx-auto w-full">
      {pipeline ? (
        <PipelineHeader pipeline={pipeline} driftCount={driftCount} />
      ) : (
        <div className="flex flex-col gap-3">
          <h1 className="title-3 text-[var(--text-primary)]">Pipeline</h1>
          <span className="mono-2 text-[var(--text-tertiary)]">{id}</span>
        </div>
      )}
      <PipelineTabs pipelineId={id} driftCount={driftCount} />
      <Suspense
        fallback={
          <div
            className="flex flex-col items-center justify-center gap-3 min-h-[400px]"
            aria-busy="true"
          >
            <Loader2
              className="h-7 w-7 animate-spin text-[var(--color-foreground-primary)]"
              role="status"
            />
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  )
}
