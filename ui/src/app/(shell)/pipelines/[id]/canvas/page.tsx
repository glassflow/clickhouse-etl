import { getPipeline } from '@/src/api/pipeline-api'
import { CanvasView } from '@/src/modules/canvas/CanvasView'

type PageProps = { params: Promise<{ id: string }> }

export default async function PipelineCanvasPage({ params }: PageProps) {
  const { id } = await params
  const pipeline = await getPipeline(id).catch(() => null)
  // Backend may not yet expose `revision`; fall back to 1 until Phase 3 wires it.
  const revision: number =
    typeof (pipeline as { revision?: number } | null)?.revision === 'number'
      ? ((pipeline as { revision: number }).revision)
      : 1
  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <CanvasView pipelineId={id} currentRevision={revision} />
    </div>
  )
}
