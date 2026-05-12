'use client'

import { useState } from 'react'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Input } from '@/src/components/ui/input'
import { useDLQActions } from '@/src/hooks/useDLQActions'
import dynamic from 'next/dynamic'

const FlushDLQModal = dynamic(() => import('@/src/modules/pipelines/components/FlushDLQModal'), { ssr: false })

interface DLQViewerProps {
  pipelineId: string
}

export function DLQViewer({ pipelineId }: DLQViewerProps) {
  const { state, loading, error, actionMessage, consuming, purging, consume, purge } = useDLQActions(pipelineId)
  const [batchSize, setBatchSize] = useState(100)
  const [showPurgeModal, setShowPurgeModal] = useState(false)

  const count = state?.count ?? 0

  return (
    <Card variant="dark" className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="title-5 text-[var(--text-primary)]">Dead Letter Queue</h3>
        {!loading && (
          <Badge variant={count > 0 ? 'error' : 'secondary'}>
            {count} {count === 1 ? 'event' : 'events'}
          </Badge>
        )}
      </div>

      {loading && <p className="body-3 text-[var(--text-secondary)]">Loading…</p>}
      {error && !loading && <p className="body-3 text-[var(--color-foreground-critical)]">{error}</p>}
      {!loading && !error && count === 0 && (
        <p className="body-3 text-[var(--text-secondary)]">No failed events in queue.</p>
      )}

      {!loading && !error && count > 0 && (
        <div className="flex items-center gap-2">
          <label className="caption-1 text-[var(--text-secondary)] shrink-0">Batch size</label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={batchSize}
            onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 100))}
            className="w-20 h-7"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => consume(batchSize)}
            loading={consuming}
            loadingText="Consuming…"
          >
            Consume
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowPurgeModal(true)}
            loading={purging}
            loadingText="Purging…"
          >
            Purge all
          </Button>
        </div>
      )}

      {actionMessage && <p className="caption-1 text-[var(--text-secondary)]">{actionMessage}</p>}

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
    </Card>
  )
}
