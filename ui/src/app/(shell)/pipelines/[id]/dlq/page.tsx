import { DLQViewer } from '@/src/modules/observability/DLQViewer'

export default async function DLQPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="p-4">
      <DLQViewer pipelineId={id} />
    </div>
  )
}
