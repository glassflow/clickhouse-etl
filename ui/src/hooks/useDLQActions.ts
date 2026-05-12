'use client'

import * as React from 'react'

export type DLQState = { count: number; size?: number }

type UseDLQActionsReturn = {
  state: DLQState | null
  loading: boolean
  error: string | null
  actionMessage: string | null
  consuming: boolean
  purging: boolean
  refetch: () => Promise<void>
  consume: (batchSize: number) => Promise<void>
  purge: () => Promise<void>
}

export function useDLQActions(pipelineId: string): UseDLQActionsReturn {
  const [state, setState] = React.useState<DLQState | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)
  const [consuming, setConsuming] = React.useState(false)
  const [purging, setPurging] = React.useState(false)

  // Tracks the latest pipelineId so in-flight requests for previous ids can
  // bail out before writing stale state when the user navigates quickly.
  const activeId = React.useRef(pipelineId)
  React.useEffect(() => {
    activeId.current = pipelineId
  }, [pipelineId])

  const refetch = React.useCallback(async () => {
    const requestedFor = pipelineId
    setLoading(true)
    try {
      const res = await fetch(`/ui-api/pipeline/${requestedFor}/dlq/state`)
      if (activeId.current !== requestedFor) return
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Failed to fetch DLQ state')
        return
      }
      const data = await res.json()
      setState(data?.data ?? data)
      setError(null)
    } catch {
      if (activeId.current !== requestedFor) return
      setError('Failed to fetch DLQ state')
    } finally {
      if (activeId.current === requestedFor) setLoading(false)
    }
  }, [pipelineId])

  React.useEffect(() => {
    refetch()
  }, [refetch])

  const consume = React.useCallback(
    async (batchSize: number) => {
      setConsuming(true)
      setActionMessage(null)
      try {
        const res = await fetch(`/ui-api/pipeline/${pipelineId}/dlq/consume?batch_size=${batchSize}`)
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          setActionMessage(`Consumed ${data?.consumed ?? batchSize} events.`)
          await refetch()
        } else {
          setActionMessage(data?.error ?? 'Consume failed')
        }
      } catch {
        setActionMessage('Consume failed')
      } finally {
        setConsuming(false)
      }
    },
    [pipelineId, refetch],
  )

  const purge = React.useCallback(async () => {
    setPurging(true)
    setActionMessage(null)
    try {
      const res = await fetch(`/ui-api/pipeline/${pipelineId}/dlq/purge`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setActionMessage('Error queue cleared.')
        await refetch()
      } else {
        const data = await res.json().catch(() => ({}))
        setActionMessage(data?.error ?? 'Purge failed')
      }
    } catch {
      setActionMessage('Purge failed')
    } finally {
      setPurging(false)
    }
  }, [pipelineId, refetch])

  return { state, loading, error, actionMessage, consuming, purging, refetch, consume, purge }
}
