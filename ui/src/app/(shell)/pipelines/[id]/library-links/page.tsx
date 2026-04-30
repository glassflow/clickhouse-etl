import { LibraryLinksTab } from '@/src/modules/pipelines/[id]/LibraryLinksTab'

type PageProps = { params: Promise<{ id: string }> }

export default async function PipelineLibraryLinksPage({ params }: PageProps) {
  const { id } = await params
  return <LibraryLinksTab pipelineId={id} />
}
