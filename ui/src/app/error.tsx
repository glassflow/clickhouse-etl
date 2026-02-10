'use client'

import { useEffect } from 'react'
import { Button } from '@/src/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-6 px-4">
      <h2 className="text-2xl font-semibold text-foreground">Something went wrong</h2>
      <p className="text-sm text-content text-center max-w-md">{error.message || 'An unexpected error occurred.'}</p>
      <Button onClick={() => reset()} variant="outline" className="btn-primary flex items-center gap-2">
        Try again
      </Button>
    </div>
  )
}
