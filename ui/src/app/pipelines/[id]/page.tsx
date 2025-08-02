import PipelineDetailsModule from '@/src/modules/pipelines/[id]/PipelineDetailsModule'
import { getPipeline } from '@/src/api/pipeline-api'

async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const finalParams = await params
  const { id } = finalParams

  // get the pipeline data from the API - Backend API call going through api routes
  const pipeline = await getPipeline(id)

  // render the pipeline details module
  return <PipelineDetailsModule pipeline={pipeline} />
}

export default PipelinePage
