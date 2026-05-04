import { Loader2 } from 'lucide-react'

export default function PipelinesLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-[400px]" aria-busy="true" aria-label="Loading pipelines">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--color-foreground-primary)]" role="status" aria-hidden />
      <p className="body-3 text-[var(--color-foreground-neutral-faded)]">Loading pipelines…</p>
    </div>
  )
}
