import PipelineDetailsModule from '@/src/modules/pipelines/[id]/PipelineDetailsModule'
import { getPipeline } from '@/src/api/pipeline-api'
import { isMockMode } from '@/src/utils/mock-api'
import PipelineDetailsClientWrapper from '@/src/modules/pipelines/[id]/PipelineDetailsClientWrapper'

async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const finalParams = await params
  const { id } = finalParams

  // In mock mode, use client-side data fetching to avoid SSR fetch issues
  if (isMockMode()) {
    return <PipelineDetailsClientWrapper pipelineId={id} />
  }

  // For real API mode, use SSR
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
