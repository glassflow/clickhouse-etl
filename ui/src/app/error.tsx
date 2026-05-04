'use client'

import { useEffect } from 'react'
import { Button } from '@/src/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-6 px-4">
      <h2 className="title-3 text-[var(--color-foreground-neutral)]">Something went wrong</h2>
      <p className="body-3 text-[var(--color-foreground-neutral-faded)] text-center max-w-md">{error.message || 'An unexpected error occurred.'}</p>
      <Button onClick={() => reset()} variant="primary" size="custom" className="flex items-center gap-2">
        Try again
      </Button>
    </div>
  )
}
