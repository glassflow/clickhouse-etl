'use client'

import { Button } from '@/src/components/ui/button'
import { ExternalLinkIcon } from 'lucide-react'
import { getRuntimeEnv } from '@/src/utils/common.client'

type DisabledStateProps = {
  surface: 'metrics' | 'logs'
}

/**
 * Renders the BYO / disabled observability state.
 *
 * Used by Metrics + Logs tabs when `NEXT_PUBLIC_INTERNAL_OBSERVABILITY_ENABLED`
 * is off. Preserves the chart frame layout (so toggling the flag does not
 * shift the page) and points users at their external Grafana plus the helm
 * snippet to flip the flag.
 */
export function DisabledState({ surface }: DisabledStateProps) {
  const env = getRuntimeEnv()
  const externalGrafana = env?.NEXT_PUBLIC_EXTERNAL_GRAFANA_URL

  const helm = `# values.yaml
internalObservability:
  enabled: true   # set this to true and re-deploy
  victoriaMetrics:
    retention: 7d
  victoriaLogs:
    retention: 3d`

  const ghosts =
    surface === 'metrics'
      ? ['Records ingested', 'p99 latency', 'DLQ rate']
      : ['Log volume', 'Error rate', 'Live tail']

  return (
    <div className="flex flex-col gap-4">
      <div
        className="grid grid-cols-3 gap-3 opacity-50 pointer-events-none"
        aria-hidden="true"
      >
        {ghosts.map((title) => (
          <GhostFrame key={title} title={title} />
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-6 flex flex-col items-center text-center gap-4">
        <div className="flex flex-col gap-1.5 max-w-md">
          <h3 className="title-5 text-[var(--text-primary)]">
            Internal {surface} are disabled
          </h3>
          <p className="body-3 text-[var(--text-secondary)]">
            GlassFlow&apos;s internal{' '}
            {surface === 'metrics' ? 'VictoriaMetrics' : 'VictoriaLogs'} stack is off.
            The OTEL collector is still fanning out to your existing observability
            backend.
          </p>
        </div>

        <pre className="mono-2 px-3 py-2 rounded bg-[var(--color-background-elevation-base)] border border-[var(--surface-border)] text-[var(--color-foreground-neutral-faded)] max-w-full overflow-x-auto text-left">
          <code>{helm}</code>
        </pre>

        <div className="flex items-center gap-2">
          {externalGrafana && (
            <Button asChild variant="primary" size="sm">
              <a href={externalGrafana} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon size={12} className="mr-1.5" />
                Open in your Grafana
              </a>
            </Button>
          )}
          <Button asChild variant="secondary" size="sm">
            <a href="/workspace/observability">Stack settings</a>
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Lightweight stand-in for the Phase-5 `ChartFrame` component.
 *
 * Phase-7 needs the disabled state to preserve the layout of the eventual
 * Phase-5 metric cards. Keeping this local (instead of importing ChartFrame)
 * means the Phase-7 worktree can land before Phase-5 merges; once Phase-5 is
 * in, callers using `<DisabledState />` already have the right shape and a
 * follow-up can swap the inline frame for the real ChartFrame in empty state.
 */
function GhostFrame({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised)] p-4 flex flex-col gap-3 min-h-[140px]">
      <span className="caption-1 text-[var(--text-secondary)]">{title}</span>
      <div className="flex-1 rounded-md bg-[var(--color-background-elevation-raised-faded)]" />
    </div>
  )
}
