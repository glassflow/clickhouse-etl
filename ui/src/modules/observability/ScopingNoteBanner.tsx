'use client'

import * as React from 'react'
import { X as XIcon } from 'lucide-react'

const LS_KEY = 'obs.scopingNoteDismissed.v1'

type Props = { pipelineId: string }

export function ScopingNoteBanner({ pipelineId }: Props) {
  const [hidden, setHidden] = React.useState(false)

  React.useEffect(() => {
    if (window.localStorage.getItem(LS_KEY) === '1') setHidden(true)
  }, [])

  if (hidden) return null

  const dismiss = () => {
    setHidden(true)
    window.localStorage.setItem(LS_KEY, '1')
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 px-4 py-3 rounded-md border border-[var(--color-foreground-primary-faded)] bg-[var(--color-orange-alpha-10)]"
    >
      <span className="caption-1 mono-2 text-[var(--color-foreground-primary)] shrink-0 pt-0.5">NOTE</span>
      <p className="caption-1 text-[var(--text-secondary)] flex-1">
        Every chart on this page is read from VictoriaMetrics with an enforced{' '}
        <code className="mono-2 text-[var(--text-primary)]">pipeline_id=&quot;{pipelineId}&quot;</code> label. Metrics
        from other pipelines are never queryable from this view.
      </p>
      <button
        type="button"
        aria-label="Dismiss scoping note"
        onClick={dismiss}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}
