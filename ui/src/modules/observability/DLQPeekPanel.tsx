'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { useDLQActions } from '@/src/hooks/useDLQActions'

const FlushDLQModal = dynamic(() => import('@/src/modules/pipelines/components/FlushDLQModal'), { ssr: false })

type Props = { pipelineId: string }

export function DLQPeekPanel({ pipelineId }: Props) {
  const { state, loading, error, actionMessage, consuming, consume, purge } = useDLQActions(pipelineId)
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const count = state?.count ?? 0

  return (
    <div className="rounded-md border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-3 flex flex-col gap-3 min-h-[180px]">
      <div className="flex items-center justify-between">
        <span className="caption-1 text-[var(--text-secondary)]">Dead-letter queue</span>
        {!loading && !error && (
          <Badge variant={count > 0 ? 'error' : 'secondary'}>
            <span>{count}</span> {count === 1 ? 'event' : 'events'}
          </Badge>
        )}
      </div>

      <div className="flex-1">
        {loading && <p className="caption-1 text-[var(--text-tertiary)]">Loading…</p>}
        {error && !loading && <p className="caption-1 text-[var(--color-foreground-critical)]">{error}</p>}
        {!loading && !error && count === 0 && (
          <p className="caption-1 text-[var(--text-tertiary)]">No failed events in queue.</p>
        )}
        {!loading && !error && count > 0 && (
          <p className="caption-1 text-[var(--text-secondary)]">
            {count} {count === 1 ? 'message has' : 'messages have'} been routed to the DLQ. Open the viewer to inspect
            them.
          </p>
        )}
        {actionMessage && <p className="caption-1 text-[var(--text-secondary)] mt-2">{actionMessage}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button asChild variant="secondary" size="sm">
          <Link href={`/pipelines/${pipelineId}/dlq`}>Open DLQ viewer →</Link>
        </Button>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={() => consume(100)} loading={consuming} loadingText="Consuming…">
              Consume 100
            </Button>
          )}
          {count > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowPurgeModal(true)}>
              Purge…
            </Button>
          )}
        </div>
      </div>

      {showPurgeModal && (
        <FlushDLQModal
          visible={showPurgeModal}
          onOk={() => {
            setShowPurgeModal(false)
            purge()
          }}
          onCancel={() => setShowPurgeModal(false)}
        />
      )}
    </div>
  )
}
