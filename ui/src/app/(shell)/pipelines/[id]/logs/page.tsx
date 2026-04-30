import { LogsTab } from '@/src/modules/observability/LogsTab'

type PageProps = { params: Promise<{ id: string }> }

export default async function PipelineLogsPage({ params }: PageProps) {
  const { id } = await params
  return (
    <div className="h-[calc(100vh-220px)]">
      <LogsTab pipelineId={id} />
    </div>
  )
}
