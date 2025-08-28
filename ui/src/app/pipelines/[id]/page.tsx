import PipelineDetailsModule from '@/src/modules/pipelines/[id]/PipelineDetailsModule'
import { getPipeline } from '@/src/api/pipeline-api'
import { isMockMode } from '@/src/utils/mock-api'
import PipelineDetailsClientWrapper from '@/src/modules/pipelines/[id]/PipelineDetailsClientWrapper'

async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const finalParams = await params
  const finalSearchParams = await searchParams
  const { id } = finalParams

  // Use client-side wrapper if deployment parameter is present or in mock mode
  // This ensures search parameters are handled properly
  if (isMockMode() || finalSearchParams?.deployment === 'progress') {
    return <PipelineDetailsClientWrapper pipelineId={id} />
  }

  // For real API mode without special parameters, use SSR
  try {
    const pipeline = await getPipeline(id)
    return <PipelineDetailsModule pipeline={pipeline} />
  } catch (error) {
    console.error('Failed to fetch pipeline during SSR:', error)
    // Fallback to client-side fetching if SSR fails
    return <PipelineDetailsClientWrapper pipelineId={id} />
  }
}

export default PipelinePage
