import { redirect } from 'next/navigation'

type PageProps = { params: Promise<{ id: string }> }

export default async function PipelineRootPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/pipelines/${id}/overview`)
}
