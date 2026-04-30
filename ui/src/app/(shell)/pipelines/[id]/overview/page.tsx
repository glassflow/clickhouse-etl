import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { structuredLogger } from '@/src/observability'
import PipelineDetailsModule from '@/src/modules/pipelines/[id]/PipelineDetailsModule'
import { getPipeline } from '@/src/api/pipeline-api'
import { isMockMode } from '@/src/utils/mock-api'
import PipelineDetailsClientWrapper from '@/src/modules/pipelines/[id]/PipelineDetailsClientWrapper'
import type { ApiError } from '@/src/types/pipeline'

function Loading() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 min-h-[400px]"
      aria-busy="true"
    >
      <Loader2
        className="h-7 w-7 animate-spin text-[var(--color-foreground-primary)]"
        role="status"
      />
      <p className="body-3 text-[var(--color-foreground-neutral-faded)]">
        Loading pipeline details…
      </p>
    </div>
  )
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PipelineOverviewPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams

  /*
   * Use client-side wrapper if deployment parameter is present or in mock mode.
   * Deployment mode is active after mapping is complete and pipeline is being deployed:
   * while deploying, the user is shown a progress indicator and the pipeline details
   * are not shown nor the pipeline is fetched from the API until the deployment is complete.
   */
  if (isMockMode() || sp?.deployment === 'progress') {
    return (
      <Suspense fallback={<Loading />}>
        <PipelineDetailsClientWrapper pipelineId={id} />
      </Suspense>
    )
  }

  try {
    const pipeline = await getPipeline(id)
    return <PipelineDetailsModule pipeline={pipeline} />
  } catch (error) {
    const err = error as ApiError & Error
    const message = err?.message ?? (error instanceof Error ? error.message : String(error))
    const code = err?.code
    structuredLogger.error('Failed to fetch pipeline during SSR', { error: message, code })
    return (
      <Suspense fallback={<Loading />}>
        <PipelineDetailsClientWrapper pipelineId={id} />
      </Suspense>
    )
  }
}
