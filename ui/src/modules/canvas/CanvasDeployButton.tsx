'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { canvasToPipelineConfig } from './serializer'

export function CanvasDeployButton() {
  const { canvasStore } = useStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeploy = async () => {
    setLoading(true)
    setError(null)
    try {
      const config = canvasToPipelineConfig(canvasStore)
      const res = await fetch('/ui-api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `Deploy failed with status ${res.status}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="caption-1 text-[var(--color-status-error)]">{error}</span>}
      <Button variant="primary" size="sm" loading={loading} loadingText="Deploying…" onClick={() => void handleDeploy()}>
        Deploy
      </Button>
    </div>
  )
}
