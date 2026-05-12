'use client'

import * as React from 'react'

export type DLQState = { count: number; size?: number }

type UseDLQActionsReturn = {
  state: DLQState | null
  loading: boolean
  error: string | null
  actionMessage: string | null
  consuming: boolean
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

  const refetch = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/ui-api/pipeline/${pipelineId}/dlq/state`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Failed to fetch DLQ state')
        return
      }
      const data = await res.json()
      setState(data?.data ?? data)
      setError(null)
    } catch {
      setError('Failed to fetch DLQ state')
    } finally {
      setLoading(false)
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
    }
  }, [pipelineId, refetch])

  return { state, loading, error, actionMessage, consuming, refetch, consume, purge }
}
