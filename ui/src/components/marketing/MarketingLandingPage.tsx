import React from 'react'
import { AuthPanel } from './AuthPanel'

// ─── Compact step visuals ─────────────────────────────────────────────────────

function KafkaStreamVisual() {
  const tracks: [number, number][] = [
    [0, 1.8],
    [0.65, 2.45],
    [1.3, 3.1],
  ]
  return (
    <div className="relative h-full flex flex-col justify-around py-1.5">
      {tracks.map((delays, i) => (
        <div
          key={i}
          className="relative h-px overflow-hidden"
          style={{ background: 'var(--surface-border)' }}
        >
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
            style={{ background: 'var(--color-foreground-primary)' }}
          />
          {delays.map((delay, j) => (
            <div
              key={j}
              className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full animate-flow-dot"
              style={{ background: 'var(--color-foreground-primary)', animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function TransformVisual() {
  return (
    <div className="h-full flex items-center gap-1.5">
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-px" style={{ background: 'var(--surface-border)' }} />
        <div className="h-px" style={{ background: 'var(--surface-border)' }} />
      </div>
      <div
        className="w-8 h-7 flex-shrink-0 rounded flex flex-col items-center justify-center gap-0.5 border"
        style={{
          borderColor: 'var(--color-border-primary)',
          background: 'var(--color-background-primary-faded)',
        }}
      >
        <div className="h-px w-4" style={{ background: 'var(--color-foreground-primary)' }} />
        <div
          className="h-px w-2.5"
          style={{ background: 'var(--color-foreground-primary)', opacity: 0.6 }}
        />
        <div
          className="h-px w-3.5"
          style={{ background: 'var(--color-foreground-primary)', opacity: 0.35 }}
        />
      </div>
      <div className="flex-1 relative flex items-center">
        <div className="h-px w-full" style={{ background: 'var(--color-border-primary)' }} />
        <div
          className="absolute right-0 w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: 'var(--color-foreground-primary)' }}
        />
      </div>
    </div>
  )
}

function ClickHouseVisual() {
  const cols = [0.82, 0.48, 0.96, 0.62, 0.76, 0.42, 0.88]
  return (
    <div className="relative h-full flex items-end gap-0.5 pb-0.5">
      {cols.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px] animate-column-rise origin-bottom"
          style={{
            height: `${h * 100}%`,
            animationDelay: `${i * 0.06}s`,
            background: `linear-gradient(to top, var(--color-foreground-primary), var(--color-foreground-primary-faded))`,
          }}
        />
      ))}
      <div
        className="absolute bottom-0.5 left-0 right-0 h-px"
        style={{ background: 'var(--surface-border)' }}
      />
    </div>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    title: 'Connect',
    description: 'Configure your Kafka source.',
    visual: <KafkaStreamVisual />,
  },
  {
    number: '02',
    title: 'Transform',
    description: 'Add stateful operations like Window-based Deduplication or Temporal Joins.',
    visual: <TransformVisual />,
  },
  {
    number: '03',
    title: 'Stream',
    description: "Map your data to ClickHouse using GlassFlow's optimized native sink.",
    visual: <ClickHouseVisual />,
  },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketingLandingPage() {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[55%_45%] min-h-[calc(100vh-5rem)]"
      style={{ background: 'var(--color-background-elevation-base)' }}
    >
      {/* ── Left panel: content ── */}
      <div className="relative flex flex-col justify-center px-10 py-16 xl:px-16 overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse at top, var(--color-background-primary-faded) 0%, transparent 70%)',
            opacity: 0.45,
          }}
        />

        <div className="relative z-10 flex flex-col gap-10 max-w-xl">
          {/* Heading */}
          <h1
            className="title-2 italic animate-fade-in-up"
            style={{ color: 'var(--text-heading)', animationFillMode: 'both' }}
          >
            Build your first demo data pipeline from Kafka to ClickHouse in minutes.
          </h1>

          {/* Steps */}
          <div className="flex flex-col gap-1">
            <p
              className="body-3 uppercase tracking-widest mb-4 animate-fade-in-up"
              style={{
                color: 'var(--text-secondary)',
                animationDelay: '100ms',
                animationFillMode: 'both',
              }}
            >
              Try the Demo:
            </p>

            {STEPS.map((step, i) => (
              <div
                key={step.number}
                className="flex items-start gap-4 py-4 animate-fade-in-up"
                style={{
                  borderTop: `1px solid var(--surface-border)`,
                  animationDelay: `${(i + 1) * 130 + 100}ms`,
                  animationFillMode: 'both',
                }}
              >
                {/* Step number */}
                <span
                  className="text-sm font-mono tracking-widest flex-shrink-0 w-7 pt-0.5"
                  style={{ color: 'var(--color-foreground-primary)' }}
                >
                  {step.number}
                </span>

                {/* Title + description */}
                <div className="flex-1 min-w-0">
                  <h2 className="title-6 mb-1" style={{ color: 'var(--text-heading)' }}>
                    {step.title}
                  </h2>
                  <p className="body-2" style={{ color: 'var(--text-secondary)' }}>
                    {step.description}
                  </p>
                </div>

                {/* Mini visual */}
                <div
                  className="flex-shrink-0 w-[80px] h-[44px] rounded overflow-hidden"
                  style={{
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-bg-sunken)',
                    padding: '6px 8px',
                  }}
                >
                  {step.visual}
                </div>
              </div>
            ))}

            <div style={{ borderTop: `1px solid var(--surface-border)` }} />
          </div>

          {/* Body text */}
          <p
            className="body-2 animate-fade-in-up"
            style={{
              color: 'var(--text-secondary)',
              animationDelay: '580ms',
              animationFillMode: 'both',
            }}
          >
            Watch your events flow through the pipeline with sub-second latency and immediate
            visibility into your ClickHouse tables.
          </p>
        </div>
      </div>

      {/* ── Right panel: auth form ── */}
      <div
        className="flex items-center justify-center px-8 py-16 xl:px-14 lg:border-l border-[var(--surface-border)]"
        style={{ background: 'var(--surface-bg)' }}
      >
        <div className="w-full max-w-sm">
          <AuthPanel />
        </div>
      </div>
    </div>
  )
}
