import { notFound } from 'next/navigation'
import { DrillDownView } from '@/src/modules/observability/DrillDownView'
import { isCanonicalKey } from '@/src/app/ui-api/pipelines/[id]/metrics/_lib/canonical-queries'

type PageProps = { params: Promise<{ id: string; query: string }> }

export default async function PipelineMetricDrillDownPage({ params }: PageProps) {
  const { id, query } = await params
  if (!isCanonicalKey(query)) notFound()
  return <DrillDownView pipelineId={id} queryKey={query} />
}
