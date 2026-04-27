import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import PipelineHealthCard from '@/src/modules/pipelines/[id]/PipelineHealthCard'
import { DLQViewer } from '@/src/modules/observability/DLQViewer'
import { NotificationChannelConfig } from '@/src/modules/observability/NotificationChannelConfig'
import type { PipelineHealth } from '@/src/api/pipeline-health'

interface PageProps {
  params: Promise<{ id: string }>
}

async function fetchPipelineHealth(id: string): Promise<PipelineHealth | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/ui-api/pipeline/${id}/health`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.health as PipelineHealth) ?? null
  } catch {
    return null
  }
}

export default async function ObservabilityPipelinePage({ params }: PageProps) {
  const { id } = await params

  const authEnabled = isAuthEnabled()
  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const health = await fetchPipelineHealth(id)

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/observability"
          className="flex items-center gap-1 caption-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeftIcon className="h-3 w-3" />
          Observability
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="title-3 text-[var(--text-primary)]">
          {health?.pipeline_name ?? id}
        </h1>
        <p className="body-3 text-[var(--text-secondary)]">Pipeline ID: {id}</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: health + DLQ */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <PipelineHealthCard health={health} isLoading={false} error={health ? null : 'Could not load health data'} />
          <DLQViewer pipelineId={id} />
        </div>

        {/* Right: notifications */}
        <div className="lg:col-span-1">
          <NotificationChannelConfig pipelineId={id} />
        </div>
      </div>
    </div>
  )
}
