import { Loader2 } from 'lucide-react'

export default function RootLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-[50vh]" aria-busy="true" aria-label="Loading">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--color-foreground-primary)]" role="status" aria-hidden />
      <p className="body-3 text-[var(--color-foreground-neutral-faded)]">Loading…</p>
    </div>
  )
}
