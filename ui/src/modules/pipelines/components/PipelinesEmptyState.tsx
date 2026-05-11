'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

const TEMPLATES = [
  { id: 'dedup', label: 'Dedup', description: 'Remove duplicate events from your stream' },
  { id: 'filter', label: 'Filter', description: 'Drop unwanted events before they land' },
  { id: 'direct-ingest', label: 'Direct ingest', description: 'Stream events straight to ClickHouse' },
]

export function PipelinesEmptyState() {
  const analytics = useJourneyAnalytics()
  const router = useRouter()

  useEffect(() => {
    analytics.page.pipelines({})
  }, [analytics])

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-10 w-full max-w-2xl mx-auto text-center">
      {/* Pipeline glyph visualization: I → T → S */}
      <div className="flex items-center gap-3 text-[var(--color-foreground-neutral-faded)]">
        <div className="w-10 h-10 rounded-lg border border-[var(--surface-border)] flex items-center justify-center text-sm font-mono font-bold text-[var(--color-foreground-info)]">
          I
        </div>
        <div className="w-6 h-px bg-[var(--surface-border)]" />
        <div className="w-10 h-10 rounded-lg border border-[var(--surface-border)] flex items-center justify-center text-sm font-mono font-bold text-[var(--color-foreground-primary)]">
          T
        </div>
        <div className="w-6 h-px bg-[var(--surface-border)]" />
        <div className="w-10 h-10 rounded-lg border border-[var(--surface-border)] flex items-center justify-center text-sm font-mono font-bold text-[var(--color-foreground-positive)]">
          S
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="title-4 text-[var(--color-foreground-neutral)]">No pipelines yet</h2>
        <p className="body-3 text-[var(--color-foreground-neutral-faded)] max-w-sm mx-auto">
          Connect your Kafka source to ClickHouse and transform events in real time before they land.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Button variant="primary" size="default" onClick={() => router.push('/home')}>
          Create from scratch
        </Button>
        <Button variant="secondary" size="default" onClick={() => router.push('/home?openAi=1')}>
          Create with AI
        </Button>
      </div>

      <div className="w-full">
        <p className="caption-1 text-[var(--color-foreground-neutral-faded)] mb-4">Quick-start templates</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => router.push('/home')}
              className="text-left p-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-bg)] hover:border-[var(--color-foreground-primary)] transition-colors group"
            >
              <p className="body-3 font-semibold text-[var(--color-foreground-neutral)] group-hover:text-[var(--color-foreground-primary)]">
                {tpl.label}
              </p>
              <p className="caption-1 text-[var(--color-foreground-neutral-faded)] mt-1">
                {tpl.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
