'use client'

import { useState } from 'react'
import {
  DatabaseIcon,
  SearchIcon,
  ShieldOffIcon,
  AlertTriangleIcon,
  ZapIcon,
} from 'lucide-react'
import { Skeleton, SkeletonRow } from '@/src/components/ui/skeleton'
import { EmptyState } from '@/src/components/ui/empty-state'
import { Pill } from '@/src/components/ui/pill'
import { LiveIndicator } from '@/src/components/ui/live-indicator'
import { Sparkline } from '@/src/components/ui/sparkline'
import { KbdHint } from '@/src/components/ui/kbd-hint'
import { Crumbs } from '@/src/components/ui/crumbs'
import { ScopeBadge } from '@/src/components/ui/scope-badge'
import { TimeRangePicker, type TimeRangeKey } from '@/src/components/ui/time-range-picker'
import { Section, Preview, PageHeader, CodeBlock } from '../_components/Section'

const upTrend = [12, 18, 15, 22, 28, 24, 31, 29, 35, 40, 38, 44]
const downTrend = [44, 38, 42, 36, 30, 34, 28, 22, 26, 18, 14, 10]
const flatTrend = [20, 22, 19, 21, 23, 20, 22, 21, 20, 22, 21, 20]
const spikeTrend = [10, 12, 11, 13, 40, 42, 38, 14, 12, 11, 13, 12]

export default function UtilitiesPage() {
  const [selectedPills, setSelectedPills] = useState<Record<string, boolean>>({})
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('1h')

  function togglePill(key: string) {
    setSelectedPills((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div>
      <PageHeader
        title="Utilities"
        description="Loading skeletons, empty states, pills, indicators, sparklines, keyboard hints, breadcrumbs, and scope badges."
      />

      {/* ── Skeleton ───────────────────────────────────────────────── */}
      <Section
        title="Skeleton"
        description="Shimmer placeholders that occupy the same layout frame as populated content. Use while data is loading — never show a spinner where a skeleton fits."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Preview label="Text lines" center={false}>
            <div className="flex flex-col gap-2">
              <Skeleton height={14} className="w-3/4" />
              <Skeleton height={14} className="w-full" />
              <Skeleton height={14} className="w-1/2" />
            </div>
          </Preview>

          <Preview label="Avatar + name row" center={false}>
            <div className="flex items-center gap-3">
              <Skeleton width={36} height={36} rounded="full" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton height={12} className="w-1/2" />
                <Skeleton height={10} className="w-1/3" />
              </div>
            </div>
          </Preview>

          <Preview label="Card" center={false}>
            <div className="flex flex-col gap-3">
              <Skeleton height={120} className="w-full" rounded="lg" />
              <Skeleton height={14} className="w-2/3" />
              <Skeleton height={12} className="w-1/3" />
            </div>
          </Preview>

          <Preview label="Table rows (SkeletonRow)" center={false}>
            <SkeletonRow count={3} rowHeight={36} />
          </Preview>
        </div>

        <CodeBlock code={`import { Skeleton, SkeletonRow } from '@/src/components/ui/skeleton'

// Single element — set width/height in px or CSS string
<Skeleton width={200} height={14} />
<Skeleton height={36} className="w-full" />
<Skeleton width={36} height={36} rounded="full" />   // avatar

// Multiple table rows
<SkeletonRow count={5} rowHeight={44} />

// Props
// width?   number | string
// height?  number | string
// rounded? 'sm' | 'md' | 'lg' | 'full'  (default: 'md')`} />
      </Section>

      {/* ── EmptyState ─────────────────────────────────────────────── */}
      <Section
        title="EmptyState"
        description="Dashed-border container for zero-data, error, and access-restricted states. Always matches the layout frame of the populated view."
      >
        <div className="flex flex-col gap-4">
          <Preview label="No data — with CTA" center={false}>
            <EmptyState
              icon={<DatabaseIcon size={28} />}
              heading="No pipelines yet"
              copy="Create your first pipeline to start streaming events from Kafka into ClickHouse."
              cta={{ label: 'Create pipeline', onClick: () => {} }}
            />
          </Preview>

          <Preview label="Error state" center={false}>
            <EmptyState
              icon={<AlertTriangleIcon size={28} />}
              heading="Failed to load schemas"
              copy="Could not connect to the library database. Check your Postgres connection and try again."
              cta={{ label: 'Retry', onClick: () => {} }}
            />
          </Preview>

          <Preview label="Access restricted — no CTA" center={false}>
            <EmptyState
              icon={<ShieldOffIcon size={28} />}
              heading="Observability not configured"
              copy="VictoriaMetrics and VictoriaLogs endpoints are not set. Configure them in the admin panel."
            />
          </Preview>

          <Preview label="With code snippet" center={false}>
            <EmptyState
              icon={<SearchIcon size={28} />}
              heading="No matching results"
              copy="Try a different search term or clear your filters."
              codeSnippet="topic:clickhouse-events status:active"
            />
          </Preview>
        </div>

        <CodeBlock code={`import { EmptyState } from '@/src/components/ui/empty-state'

<EmptyState
  icon={<DatabaseIcon size={28} />}
  heading="No pipelines yet"
  copy="Create your first pipeline to get started."
  cta={{ label: 'Create pipeline', onClick: handleCreate }}
/>

// Props
// icon?        React.ReactNode
// heading      string  (required)
// copy         string  (required)
// cta?         { label: string; onClick?: () => void; href?: string }
// codeSnippet? string  (renders in a <pre> block)`} />
      </Section>

      {/* ── Pill ───────────────────────────────────────────────────── */}
      <Section
        title="Pill"
        description="Filter chips and tag labels. Interactive when onSelect is provided — becomes a toggle button with aria-pressed."
      >
        <div className="flex flex-col gap-4">
          <Preview label="Static labels" center={false}>
            <div className="flex flex-wrap gap-2">
              <Pill>kafka</Pill>
              <Pill>clickhouse</Pill>
              <Pill>active</Pill>
            </div>
          </Preview>

          <Preview label="With count" center={false}>
            <div className="flex flex-wrap gap-2">
              <Pill count={12}>Pipelines</Pill>
              <Pill count={3}>Errors</Pill>
              <Pill count={0}>Warnings</Pill>
            </div>
          </Preview>

          <Preview label="With swatch color" center={false}>
            <div className="flex flex-wrap gap-2">
              <Pill swatchColor="var(--color-foreground-positive)">Active</Pill>
              <Pill swatchColor="var(--color-foreground-warning)">Degraded</Pill>
              <Pill swatchColor="var(--color-foreground-critical)">Failed</Pill>
            </div>
          </Preview>

          <Preview label="Interactive — click to toggle" center={false}>
            <div className="flex flex-wrap gap-2">
              {['Status', 'Type', 'Source', 'Region'].map((label) => (
                <Pill
                  key={label}
                  selected={selectedPills[label]}
                  onSelect={() => togglePill(label)}
                  count={selectedPills[label] ? 2 : undefined}
                >
                  {label}
                </Pill>
              ))}
            </div>
          </Preview>
        </div>

        <CodeBlock code={`import { Pill } from '@/src/components/ui/pill'

// Static label
<Pill>kafka</Pill>

// With count badge
<Pill count={12}>Pipelines</Pill>

// With color swatch
<Pill swatchColor="var(--color-foreground-positive)">Active</Pill>

// Interactive toggle
<Pill selected={isSelected} onSelect={() => setSelected(!isSelected)}>
  Filter
</Pill>

// Props
// selected?    boolean
// onSelect?    () => void   — makes it a <button> with aria-pressed
// count?       number
// swatchColor? string       — CSS color value`} />
      </Section>

      {/* ── LiveIndicator ──────────────────────────────────────────── */}
      <Section
        title="LiveIndicator"
        description="Pulsing dot used in metrics and log toolbars to show live-tail or auto-refresh state."
      >
        <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col gap-2 items-start">
            <LiveIndicator active={true} />
            <span className="text-xs text-[var(--text-secondary)]">active=true (default)</span>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <LiveIndicator active={false} />
            <span className="text-xs text-[var(--text-secondary)]">active=false</span>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <LiveIndicator active={true} label="streaming" />
            <span className="text-xs text-[var(--text-secondary)]">custom label</span>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <LiveIndicator active={true} label="auto-refresh" />
            <span className="text-xs text-[var(--text-secondary)]">auto-refresh label</span>
          </div>
        </div>

        <CodeBlock code={`import { LiveIndicator } from '@/src/components/ui/live-indicator'

<LiveIndicator />                            // active by default, label="live"
<LiveIndicator active={false} />             // grey dot, no pulse
<LiveIndicator active={true} label="streaming" />

// Props
// active? boolean  (default: true)
// label?  string   (default: 'live')`} />
      </Section>

      {/* ── Sparkline ──────────────────────────────────────────────── */}
      <Section
        title="Sparkline"
        description="Inline SVG trend line for KPI cards, table cells, and dashboard summaries. Renders a polyline from an array of numbers."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Preview label="Upward trend">
            <div className="flex flex-col items-center gap-2">
              <Sparkline data={upTrend} stroke="var(--color-foreground-positive)" />
              <span className="text-xs text-[var(--color-foreground-positive)]">+18.5%</span>
            </div>
          </Preview>

          <Preview label="Downward trend">
            <div className="flex flex-col items-center gap-2">
              <Sparkline data={downTrend} stroke="var(--color-foreground-critical)" />
              <span className="text-xs text-[var(--color-foreground-critical)]">−22.3%</span>
            </div>
          </Preview>

          <Preview label="Flat / stable">
            <div className="flex flex-col items-center gap-2">
              <Sparkline data={flatTrend} stroke="var(--color-foreground-neutral-faded)" />
              <span className="text-xs text-[var(--text-secondary)]">stable</span>
            </div>
          </Preview>

          <Preview label="Spike">
            <div className="flex flex-col items-center gap-2">
              <Sparkline data={spikeTrend} stroke="var(--color-foreground-warning)" />
              <span className="text-xs text-[var(--color-foreground-warning)]">spike</span>
            </div>
          </Preview>
        </div>

        <CodeBlock code={`import { Sparkline } from '@/src/components/ui/sparkline'

<Sparkline
  data={[12, 18, 15, 22, 28, 35, 44]}
  stroke="var(--color-foreground-positive)"
/>

// Props — all optional except data
// data         number[]  (required)
// width?       number    (default: 120)
// height?      number    (default: 32)
// stroke?      string    CSS color (default: var(--color-foreground-primary))
// fill?        string    CSS color (default: 'none')
// strokeWidth? number    (default: 1.5)`} />
      </Section>

      {/* ── KbdHint ────────────────────────────────────────────────── */}
      <Section
        title="KbdHint"
        description="Keyboard shortcut labels for command palette triggers, tooltips, and inline hints. aria-hidden — decorative only."
      >
        <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col gap-2 items-center">
            <KbdHint keys={['⌘']} />
            <span className="text-xs text-[var(--text-secondary)]">single key</span>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <KbdHint keys={['⌘', 'K']} />
            <span className="text-xs text-[var(--text-secondary)]">chord</span>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <KbdHint keys={['Ctrl', 'Shift', 'P']} />
            <span className="text-xs text-[var(--text-secondary)]">3-key chord</span>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <KbdHint keys={['Esc']} />
            <span className="text-xs text-[var(--text-secondary)]">named key</span>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <p className="body-3 text-[var(--text-secondary)] mb-3">Inline usage in a button label:</p>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--surface-bg)] border border-[var(--surface-border)]">
            <ZapIcon size={14} className="text-[var(--color-foreground-primary)]" />
            <span className="body-3 text-[var(--text-primary)]">Ask AI</span>
            <KbdHint keys={['⌘', 'K']} />
          </div>
        </div>

        <CodeBlock code={`import { KbdHint } from '@/src/components/ui/kbd-hint'

<KbdHint keys={['⌘', 'K']} />       // renders two <kbd> elements
<KbdHint keys={['Esc']} />

// Props
// keys     string[]  (required) — one element per <kbd>`} />
      </Section>

      {/* ── Crumbs ─────────────────────────────────────────────────── */}
      <Section
        title="Crumbs"
        description="Breadcrumb navigation. Last crumb is the current page (aria-current=page, non-linked). All previous crumbs are links."
      >
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div>
            <Crumbs crumbs={[{ label: 'Library', href: '/library' }, { label: 'Schemas' }]} />
            <span className="text-xs text-[var(--text-secondary)] mt-1 block">2-level</span>
          </div>
          <div>
            <Crumbs
              crumbs={[
                { label: 'Library', href: '/library' },
                { label: 'Schemas', href: '/library/schemas' },
                { label: 'clickhouse-events-v2' },
              ]}
            />
            <span className="text-xs text-[var(--text-secondary)] mt-1 block">3-level</span>
          </div>
          <div>
            <Crumbs
              crumbs={[
                { label: 'Pipelines', href: '/pipelines' },
                { label: 'etl-prod-kafka', href: '/pipelines/abc123' },
                { label: 'Canvas', href: '/pipelines/abc123/canvas' },
                { label: 'Node config' },
              ]}
            />
            <span className="text-xs text-[var(--text-secondary)] mt-1 block">4-level (deep nesting)</span>
          </div>
        </div>

        <CodeBlock code={`import { Crumbs, type Crumb } from '@/src/components/ui/crumbs'

<Crumbs
  crumbs={[
    { label: 'Library', href: '/library' },
    { label: 'Schemas', href: '/library/schemas' },
    { label: 'my-schema' },  // last item: no href → aria-current="page"
  ]}
/>

// Crumb type: { label: string; href?: string }`} />
      </Section>

      {/* ── ScopeBadge ─────────────────────────────────────────────── */}
      <Section
        title="ScopeBadge"
        description="Indicates that a metrics or logs query is server-side scoped to a specific pipeline. Always shown alongside the MetricsToolbar and LogsToolbar when a pipelineId is active."
      >
        <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col gap-2 items-start">
            <ScopeBadge pipelineId="etl-prod-kafka-clickhouse" />
            <span className="text-xs text-[var(--text-secondary)]">full ID</span>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <ScopeBadge pipelineId="abc123" />
            <span className="text-xs text-[var(--text-secondary)]">short ID</span>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <ScopeBadge pipelineId="a-very-long-pipeline-identifier-that-truncates-in-the-badge" />
            <span className="text-xs text-[var(--text-secondary)]">truncated (max 160px)</span>
          </div>
        </div>

        <CodeBlock code={`import { ScopeBadge } from '@/src/components/ui/scope-badge'

// Shown in MetricsToolbar and LogsToolbar when viewing a specific pipeline
<ScopeBadge pipelineId={pipeline.id} />

// Props
// pipelineId  string  (required)`} />
      </Section>

      {/* ── TimeRangePicker ────────────────────────────────────── */}
      <Section
        title="TimeRangePicker"
        description="Segmented control for selecting a time window. Used in MetricsToolbar and LogsToolbar. Custom range opens a calendar modal — handle that externally."
      >
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-[var(--surface-bg-sunken)] border border-[var(--surface-border)]">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono text-[var(--text-secondary)]">default preset ranges</span>
            <TimeRangePicker value={timeRange} onChange={setTimeRange} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono text-[var(--text-secondary)]">custom subset</span>
            <TimeRangePicker
              value={timeRange}
              onChange={setTimeRange}
              ranges={[
                { key: '1h', label: '1h' },
                { key: '6h', label: '6h' },
                { key: '24h', label: '24h' },
              ]}
            />
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Selected: <span className="font-mono text-[var(--color-foreground-primary)]">{timeRange}</span>
          </p>
        </div>
        <CodeBlock code={`import { TimeRangePicker, type TimeRangeKey } from '@/src/components/ui/time-range-picker'

const [range, setRange] = useState<TimeRangeKey>('1h')

<TimeRangePicker value={range} onChange={setRange} />

// Custom ranges — omit 'custom' if you don't handle the calendar modal
<TimeRangePicker
  value={range}
  onChange={(key) => {
    if (key === 'custom') { openCalendarModal(); return }
    setRange(key)
  }}
  ranges={DEFAULT_RANGES}  // import from time-range-picker
/>

// TimeRangeKey: '15m' | '1h' | '6h' | '24h' | '7d' | 'custom'`} />
      </Section>
    </div>
  )
}
