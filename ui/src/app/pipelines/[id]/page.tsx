import { cache, Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { structuredLogger } from '@/src/observability'
import type { Metadata } from 'next'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import PipelineDetailsModule from '@/src/modules/pipelines/[id]/PipelineDetailsModule'
import { getPipeline } from '@/src/api/pipeline-api'
import { isMockMode } from '@/src/utils/mock-api'
import PipelineDetailsClientWrapper from '@/src/modules/pipelines/[id]/PipelineDetailsClientWrapper'
import type { ApiError } from '@/src/types/pipeline'

// Deduplicate getPipeline for generateMetadata and page (same request)
const getCachedPipeline = cache(getPipeline)

function PipelineDetailsLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-content">Loading pipeline details...</p>
      </div>
    </div>
  )
}

type PageParams = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
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

async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Check authentication
  const authEnabled = isAuthEnabled()

  if (authEnabled) {
    const session = await getSessionSafely()

    if (!session?.user) {
      redirect('/')
    }
  }

  const finalParams = await params
  const finalSearchParams = await searchParams
  const { id } = finalParams

  /*
  * Use client-side wrapper if deployment parameter is present or in mock mode
  * This ensures search parameters are handled properly
  * Deployment mode is active after mapping is complete and pipeline is being deployed
  * While deploying, the user is shown a progress indicator
  * and the pipeline details are not shown nor the pipeline is fetched from the API
  * until the deployment is complete
  */
  if (isMockMode() || finalSearchParams?.deployment === 'progress') {
    return (
      <Suspense fallback={<PipelineDetailsLoadingFallback />}>
        <PipelineDetailsClientWrapper pipelineId={id} />
      </Suspense>
    )
  }

  // For real API mode without special parameters, use SSR (getCachedPipeline deduplicates with generateMetadata)
  try {
    const pipeline = await getCachedPipeline(id)

    return <PipelineDetailsModule pipeline={pipeline} />
  } catch (error) {
    structuredLogger.error('Failed to fetch pipeline during SSR', { error: error instanceof Error ? error.message : String(error) })

    // Check if this is a 404 error (pipeline not found) — use Next.js not-found boundary
    const apiError = error as ApiError
    if (apiError?.code === 404) {
      notFound()
    }

    // For other errors, fallback to client-side fetching
    return (
      <Suspense fallback={<PipelineDetailsLoadingFallback />}>
        <PipelineDetailsClientWrapper pipelineId={id} />
      </Suspense>
    )
  }
}

export default PipelinePage
