'use client'

import { cn } from '@/src/utils/common.client'

type FanOutDiagramProps = {
  collectorEndpoint: string | null
  external: Array<{ name: string; url: string }>
  internalEnabled: boolean
}

/**
 * Three-column visual showing how OTEL data fans out:
 *   Pipelines  →  OTEL Collector  →  { Internal stack, External backends }
 *
 * Reinforces the design contract that flipping the internal flag is purely
 * additive — external backends keep receiving data either way.
 */
export function FanOutDiagram({
  collectorEndpoint,
  external,
  internalEnabled,
}: FanOutDiagramProps) {
  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--color-background-elevation-raised-faded)] p-4 flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-4 items-center">
        <Box title="Pipelines" mono="OTEL emit" />
        <Box title="OTEL Collector" mono={collectorEndpoint ?? 'not configured'} highlight />
        <div className="flex flex-col gap-2">
          <Box
            title="Internal stack"
            mono={internalEnabled ? 'VM + VL' : 'disabled'}
            tone={internalEnabled ? 'positive' : 'muted'}
          />
          {external.length === 0 ? (
            <Box title="External backends" mono="none configured" tone="muted" />
          ) : (
            external.map((t) => (
              <Box key={t.url} title={t.name} mono={t.url} tone="info" />
            ))
          )}
        </div>
      </div>
      <p className="caption-1 text-[var(--text-tertiary)]">
        Enabling the internal stack is purely additive — your external backends keep
        receiving data.
      </p>
    </div>
  )
}

type BoxProps = {
  title: string
  mono: string
  tone?: 'positive' | 'info' | 'muted'
  highlight?: boolean
}

function Box({ title, mono, tone, highlight }: BoxProps) {
  const toneClass =
    tone === 'positive'
      ? 'border-[var(--color-foreground-positive)]'
      : tone === 'info'
        ? 'border-[var(--obs-chart-ingestor)]'
        : tone === 'muted'
          ? 'border-dashed border-[var(--color-foreground-disabled)]'
          : 'border-[var(--surface-border)]'

  return (
    <div
      className={cn(
        'rounded-md border p-3 flex flex-col gap-1',
        toneClass,
        highlight
          ? 'bg-[var(--color-orange-alpha-10)]'
          : 'bg-[var(--color-background-elevation-raised)]',
      )}
    >
      <span className="body-3 text-[var(--text-primary)]">{title}</span>
      <span className="mono-2 text-[var(--text-tertiary)] truncate">{mono}</span>
    </div>
  )
}
