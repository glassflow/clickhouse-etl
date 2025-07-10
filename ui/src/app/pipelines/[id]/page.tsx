import PipelineDetailsModule from '@/src/modules/pipelines/[id]/PipelineDetailsModule'
import { getPipeline } from '@/src/api/pipeline-api'

async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const finalParams = await params
  console.log('Params:', finalParams)
  const { id } = finalParams

  const pipeline = await getPipeline(id)

  console.log('Pipeline:', pipeline)

  return <PipelineDetailsModule pipeline={pipeline} />
}

export default PipelinePage
