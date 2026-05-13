import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ObservabilityPipelinePage({ params }: PageProps) {
  const { id } = await params
  redirect(`/pipelines/${id}/overview`)
}
