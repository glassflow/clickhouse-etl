'use client'

import { useEffect } from 'react'
import { Button } from '@/src/components/ui/button'

export default function PipelineError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-6 px-4">
      <h2 className="text-2xl font-semibold text-foreground">Pipeline error</h2>
      <p className="text-sm text-content text-center max-w-md">{error.message || 'Failed to load pipeline.'}</p>
      <div className="flex gap-3">
        <Button onClick={() => reset()} variant="primary" className="flex items-center gap-2">
          Try again
        </Button>
        <Button asChild variant="primary" className="flex items-center gap-2">
          <a href="/pipelines">Back to Pipelines</a>
        </Button>
      </div>
    </div>
  )
}
