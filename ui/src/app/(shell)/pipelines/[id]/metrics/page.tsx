import { MetricsTab } from '@/src/modules/observability/MetricsTab'

type PageProps = { params: Promise<{ id: string }> }

export default async function PipelineMetricsPage({ params }: PageProps) {
  const { id } = await params
  return <MetricsTab pipelineId={id} />
}
