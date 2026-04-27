'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Input } from '@/src/components/ui/input'
import dynamic from 'next/dynamic'

const FlushDLQModal = dynamic(
  () => import('@/src/modules/pipelines/components/FlushDLQModal'),
  { ssr: false },
)

interface DLQState {
  count?: number
  size?: number
}

interface DLQViewerProps {
  pipelineId: string
}

export function DLQViewer({ pipelineId }: DLQViewerProps) {
  const [state, setState] = useState<DLQState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [batchSize, setBatchSize] = useState(100)
  const [consuming, setConsuming] = useState(false)
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/ui-api/pipeline/${pipelineId}/dlq/state`)
      const data = await res.json()
      if (res.ok) {
        setState(data?.data ?? data)
      } else {
        setError(data?.error ?? 'Failed to fetch DLQ state')
      }
    } catch {
      setError('Failed to fetch DLQ state')
    } finally {
      setLoading(false)
    }
  }, [pipelineId])

  useEffect(() => { fetchState() }, [fetchState])

  const handleConsume = async () => {
    setConsuming(true)
    setActionMsg(null)
    try {
      const res = await fetch(`/ui-api/pipeline/${pipelineId}/dlq/consume?batch_size=${batchSize}`)
      const data = await res.json()
      if (res.ok) {
        setActionMsg(`Consumed ${data?.consumed ?? batchSize} events.`)
        fetchState()
      } else {
        setActionMsg(data?.error ?? 'Consume failed')
      }
    } catch {
      setActionMsg('Consume failed')
    } finally {
      setConsuming(false)
    }
  }

  const handlePurge = async () => {
    try {
      const res = await fetch(`/ui-api/pipeline/${pipelineId}/dlq/purge`, { method: 'DELETE' })
      if (res.ok) {
        setActionMsg('Error queue cleared.')
        fetchState()
      } else {
        const data = await res.json().catch(() => ({}))
        setActionMsg(data?.error ?? 'Purge failed')
      }
    } catch {
      setActionMsg('Purge failed')
    }
  }

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

      {loading && (
        <p className="body-3 text-[var(--text-secondary)]">Loading…</p>
      )}

      {error && !loading && (
        <p className="body-3 text-[var(--color-foreground-critical)]">{error}</p>
      )}

      {!loading && !error && count === 0 && (
        <p className="body-3 text-[var(--text-secondary)]">No failed events in queue.</p>
      )}

      {!loading && !error && count > 0 && (
        <div className="flex flex-col gap-3">
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
            <Button variant="secondary" size="sm" onClick={handleConsume} loading={consuming} loadingText="Consuming…">
              Consume
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowPurgeModal(true)}>
              Purge all
            </Button>
          </div>
        </div>
      )}

      {actionMsg && (
        <p className="caption-1 text-[var(--text-secondary)]">{actionMsg}</p>
      )}

      {showPurgeModal && (
        <FlushDLQModal
          visible={showPurgeModal}
          onOk={() => { setShowPurgeModal(false); handlePurge() }}
          onCancel={() => setShowPurgeModal(false)}
        />
      )}
    </Card>
  )
}
