# Dashboard Design Spec — 2026-05-06

## Overview

Replace the current minimal `DashboardClient.tsx` with a full-featured system overview dashboard that serves as the app's primary landing surface. The dashboard renders four discrete states driven by pipeline count and system health data, all backed by a mock layer until real backend metrics APIs are available.

Source of truth for the visual design: `docs/claude_design_handovers/glassflow-revamp-reimagined/project/components/dashboard-artboards.jsx` and `styles/dashboard.css`.

---

## Goals

- Give operators an at-a-glance view of system health: active pipelines, throughput, error rate, DLQ, lag.
- Surface incidents that need action without requiring navigation away.
- Handle the zero-pipelines state gracefully as an onboarding entry point.
- All data is mocked locally; backend API wiring is a subsequent phase.

---

## Routing Changes

| From | To | Change |
|---|---|---|
| `/` (root, auth disabled, has pipelines) | `/dashboard` | Replace `/pipelines` redirect with `/dashboard` |
| `/` (root, auth disabled, no pipelines) | `/dashboard` | Replace `/home` redirect with `/dashboard` |
| `/` (root, auth enabled, logged-in) | `/dashboard` | Same — both branches go to `/dashboard` |
| `/home` | `/dashboard` | Permanent redirect (301) |
| `/dashboard` | — | No change to URL, replaces content |

The dashboard's first-run state absorbs the role that `/home` currently plays.

---

## Dashboard States

State is determined server-side in `page.tsx` from pipeline list + dashboard stats, and passed to the client component as a discriminated union.

```ts
type DashboardState =
  | { kind: 'first-run' }
  | { kind: 'healthy'; pipelines: DashPipeline[]; stats: DashStats }
  | { kind: 'populated'; pipelines: DashPipeline[]; stats: DashStats; incidents: Incident[] }
  | { kind: 'incident'; pipelines: DashPipeline[]; stats: DashStats; incidents: Incident[] }
```

**Determination logic (ordered):**

1. `pipelines.length === 0` → `first-run`
2. `incidents.length === 0` → `healthy`
3. `incidents.length ≤ 5` AND no pipeline with `status === 'fail'` → `populated`
4. Otherwise → `incident`

---

## Layout — Populated & Incident States

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER  title · subtitle · [env picker] [range] [+ New]   │
├─────────────────────────────────────────────────────────────┤
│  KPI STRIP   5 cards: pipelines · events/s · errors · DLQ  │
├────────────────────────────────┬────────────────────────────┤
│  ATTENTION QUEUE (1.4fr)       │  SIDE STACK (1fr)          │
│  incident rows                 │  throughput chart          │
│                                │  ─────────────             │
│                                │  activity feed             │
├────────────────────────────────┴────────────────────────────┤
│  PIPELINE TABLE  filterable, full-width                     │
└─────────────────────────────────────────────────────────────┘
```

Container max-width: `1240px` (matches `AppTopbar`), padding `0 40px`.

**Healthy state variation:** same layout but:
- `HealthyBanner` is inserted between the header and the KPI strip (full-width)
- The main grid below the KPIs becomes `1fr 1fr` (two equal columns): throughput chart on the left, activity feed on the right — no attention queue
- The pipeline table renders below as normal

---

## Layout — First-Run State

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER  "Welcome to GlassFlow" · subtitle · [Docs] [Demo] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│          ┌──────────────────────────────────┐              │
│          │  orange icon mark (SVG waveform)  │              │
│          │  "Let's set up your first pipeline" h2           │
│          │  description paragraph            │              │
│          │  ┌──────┬──────┬──────┐          │              │
│          │  │Wizard│Templ.│Canvas│          │              │
│          │  ├──────┼──────┼──────┤          │              │
│          │  │  AI  │Import│Sample│          │              │
│          │  └──────┴──────┴──────┘          │              │
│          │  footer links                    │              │
│          └──────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### Module location: `src/modules/dashboard/`

```
src/modules/dashboard/
  types.ts
  mock-data.ts
  components/
    DashHeader.tsx
    KpiStrip.tsx
    KpiCard.tsx
    AttentionQueue.tsx
    HealthyBanner.tsx
    ThroughputChart.tsx
    ActivityFeed.tsx
    PipelineTable.tsx
    DashFirstRun.tsx
```

### `types.ts`

```ts
export type DashStats = {
  activePipelines: number
  totalPipelines: number
  eventsPerSec: number
  eventsPerSecDelta: number        // % change, signed
  errorRate: number                // percent
  errorRateDelta: number
  dlqEvents: number
  dlqDelta: number
  avgLagMs: number
  avgLagMsDelta: number
  throughputIn: number             // events last hour
  throughputOut: number
  throughputLossPct: number
  throughputSeries: {              // 60-point time series for chart
    in: number[]
    out: number[]
  }
}

export type IncidentSeverity = 'crit' | 'warn' | 'info'

export type Incident = {
  id: string
  severity: IncidentSeverity
  pipelineName: string
  title: string
  description: string
  meta: string[]                   // e.g. ["started 47m ago", "412 events"]
  ctaLabel: string
  ctaHref?: string                 // if undefined, disabled
}

export type ActivityItem = {
  kind: 'deploy' | 'fail' | 'pause' | 'info'
  text: string                     // rendered as HTML-safe plain text
  pipelineName?: string
  actor?: string
  relativeTime: string             // e.g. "14m ago"
}

export type DashPipeline = {
  id: string
  name: string
  version: string
  sourceTopic: string
  destTable: string
  status: 'run' | 'deg' | 'fail' | 'paused' | 'draft'
  statusLabel: string
  throughput: string
  throughputUnit: string
  lagP95: string
  lagUnit: string
  lagSeverity?: 'warn' | 'crit'
  dlq: string
  dlqSeverity?: 'warn' | 'crit'
  lastDeploy: string
  deployedBy: string
}

export type DashboardState =
  | { kind: 'first-run' }
  | { kind: 'healthy'; pipelines: DashPipeline[]; stats: DashStats }
  | { kind: 'populated'; pipelines: DashPipeline[]; stats: DashStats; incidents: Incident[] }
  | { kind: 'incident'; pipelines: DashPipeline[]; stats: DashStats; incidents: Incident[] }
```

---

### `DashHeader`

Props: `state: DashboardState`, `env: string`, `range: string`, `onEnvChange`, `onRangeChange`

- `first-run` state: title = "Welcome to GlassFlow", subtitle from design, right side = `[Docs]` + `[Watch demo · 3min]` pills (no env/range/new-pipeline)
- `healthy` state: title = "Dashboard", subtitle = "Everything's running smoothly · {n} pipelines active" (green tint)
- `populated` state: title = "Dashboard", subtitle = "{n} things need your attention · {m} pipelines active"
- `incident` state: title = "Several pipelines need attention", subtitle = "{crit} critical · {warn} warnings · {deploying} deploy in progress" (red tint)

Right-side pills for non-first-run: env selector, range selector, "+ New pipeline" CTA (links to `/`).

Pills are local `useState` in `DashboardClient` — not persisted, no URL sync.

---

### `KpiStrip`

5 `KpiCard` components in a `grid-template-columns: repeat(5, 1fr)` grid.

**Cards (in order):**

| # | Label | Value source | Unit | Spark color | Warn condition |
|---|---|---|---|---|---|
| 1 | Active pipelines | `stats.activePipelines / stats.totalPipelines` | `/ {total}` | gray | none |
| 2 | Events / sec | `stats.eventsPerSec` | `in` | orange-300 | none |
| 3 | Error rate | `stats.errorRate` | `%` | yellow-400 | `> 0.1%` → warn, `> 1%` → crit |
| 4 | DLQ events | `stats.dlqEvents` | — | red-500 | `> 100` → warn, `> 1000` → crit |
| 5 | Avg lag | `stats.avgLagMs` | `ms · p95` | gray | `> 2000ms` → warn |

**`KpiCard` props:** `label`, `value`, `unit`, `delta`, `deltaDirection: 'up' | 'down' | 'flat'`, `severity: 'default' | 'warn' | 'crit'`, `sparkData: number[]`, `sparkColor`

Sparkline: inline SVG polyline, 64×24px, positioned absolute top-right of card. Matches `Spark` component in reference design.

Delta display:
- `up` + good metric (events/sec): green
- `up` + bad metric (errors, DLQ): red
- `down` + bad metric improving: green
- `flat`: muted

---

### `AttentionQueue`

Renders the list of incidents. Hidden in `healthy` state.

Each `Incident` renders as a row with:
- 3px colored left stripe (`crit` → red, `warn` → yellow, `info` → blue)
- 28×28 icon badge (background tinted to match severity)
- Body: pipeline name tag (monospace, orange, pill background) + title + description + meta row
- CTA button (right-aligned): severity-colored for `crit`, ghost for `warn`/`info`

Card header: "Needs your attention" + count badge + sort control (`Sort by impact ▾` in incident state).

---

### `HealthyBanner`

Only shown in `healthy` state, rendered above the KPI strip.

Green gradient banner (`background: linear-gradient(90deg, var(--color-green-750) 0%, transparent 80%)`), left border `3px solid var(--color-green-500)`, check icon badge, title "All pipelines healthy", description, right-aligned last-incident timestamp. Matches the original `healthy-banner` CSS exactly.

---

### `ThroughputChart`

SVG area/line chart:
- Two series: events-in (solid orange line + gradient fill) and events-out (dashed blue line)
- Grid lines at 25%, 50%, 75% (dashed, `var(--color-gray-dark-800)`)
- Totals row above chart: In · last hour, Out · last hour, Loss % (loss colored yellow if `> 1%`, red if `> 10%`)
- Legend below chart
- "Open in observability →" link (top-right of card header)
- In `incident` state, card title becomes "Throughput · with incident overlay" — no actual overlay in phase 1, just the label change

Data: `stats.throughputSeries.in` and `stats.throughputSeries.out` (60 points each).

---

### `ActivityFeed`

List of `ActivityItem` rows:
- Colored 6px dot (`deploy` → green, `fail` → red, `pause` → yellow, `info` → blue)
- Text with optional `pipelineName` (monospace, orange) and `actor` (bold)
- Relative timestamp (monospace, muted)

"View log →" link in card header. In `incident` state, the header link is omitted (matches reference design).

---

### `PipelineTable`

Full-width below the main grid. Always rendered in non-first-run states.

**Filter chips:** All · Running · Degraded · Paused · Drafts (with live counts from `pipelines` array). Clicking a chip filters the table rows client-side. Default: All active.

**Sort control:** "Sort: throughput ▾" chip — static label in phase 1, no actual re-sorting.

**Columns:**

| Column | Content |
|---|---|
| Pipeline | Name (Archivo bold) + version badge (monospace, small, dark bg) |
| Source → destination | `sourceTopic → destTable` in monospace with Kafka/CH icons |
| Status | `StatusChip` — run/deg/fail/paused/draft variants |
| Throughput | Right-aligned, monospace |
| Lag · p95 | Right-aligned; `warn` or `crit` color class when severity set |
| DLQ | Right-aligned; colored when severity set |
| Last deploy | Two-line: relative time + "by {actor}" |
| Actions | Three icon buttons: canvas, metrics, more |

**`StatusChip`** variants use CSS classes mirroring the reference: `run` (green), `deg` (yellow), `fail` (red), `paused` (blue), `draft` (gray with border).

Row hover: `rgba(255,255,255,0.015)` background. Row click → navigate to `/pipelines/{id}`.

---

### `DashFirstRun`

Centered container with `display: flex; align-items: center; justify-content: center` filling remaining vertical space.

Inner card: `width: 640px; max-width: 100%; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; padding: 48px 56px; text-align: center`.

**Icon mark:** 56×56px, `border-radius: 14px`, orange gradient background, SVG waveform (`M3 12h4l3-8 4 16 3-8h4`), drop shadow.

**Heading:** "Let's set up your first pipeline" — Archivo 22px 600.

**Description:** "Pick the path that fits how you work. You can always switch — every path produces the same draft, which you'll review before deploying."

**Action grid** — `grid-template-columns: 1fr 1fr 1fr`, 6 tiles:

| Position | Label | Sub-label | Target | State |
|---|---|---|---|---|
| [1,1] | Guided wizard | Step-by-step · ~3 min | `/` (home, normal wizard flow) | Active |
| [1,2] | From template | Kafka → ClickHouse, OTLP logs & more | — | **Disabled** |
| [1,3] | Visual canvas | Drag-and-connect · advanced | `/pipelines/canvas` | Active |
| [2,1] | Ask AI | Describe it · we draft for you | `/pipelines/create/ai` | Active |
| [2,2] | Import config | Paste YAML / JSON | Opens import modal | Active |
| [2,3] | Try with sample data | No setup · explore the UI | — | **Disabled** |

Disabled tiles: `opacity: 0.4`, `cursor: not-allowed`, `pointer-events: none`, `border-style: dashed`. No click handler.

Each active tile: 28×28 icon wrap (orange tinted bg, orange icon), name (Archivo 12.5px bold), sub-label (11px muted). Hover: orange border + orange-alpha background.

**Footer:** "New to GlassFlow? `Read the 5-minute intro` · `Browse examples`" — both links are `href="#"` (external doc links, TBD).

---

## Mock Data Layer

### New files

```
src/app/ui-api/mock/data/dashboard.ts          ← seed data (stats, incidents, pipelines, activity)
src/app/ui-api/mock/dashboard/stats/route.ts   ← GET → { stats, incidents, activity }
src/app/ui-api/mock/dashboard/pipelines/route.ts ← GET → { pipelines: DashPipeline[] }
```

### `mock/data/dashboard.ts`

Exports three named scenario sets activated by an optional `?scenario=` query param on the mock routes:

| Scenario | Description |
|---|---|
| `populated` | 14 pipelines, 3 incidents (crit/warn/info), normal KPIs |
| `healthy` | 14 pipelines, 0 incidents, all-green KPIs |
| `incident` | 11 active / 3 degraded, 6 incidents (2 crit, 3 warn, 1 info), elevated error/DLQ |
| (omitted) | Defaults to `populated` |

Seed data is lifted verbatim from the JSX fixture data in `dashboard-artboards.jsx` (`populatedRows`, `healthyRows`, `incidentsRows`), translated into `DashPipeline` and `Incident` shapes.

### Route response shape

```ts
// GET /ui-api/mock/dashboard/stats?scenario=populated
{
  stats: DashStats
  incidents: Incident[]
  activity: ActivityItem[]
}

// GET /ui-api/mock/dashboard/pipelines?scenario=populated
{
  pipelines: DashPipeline[]
}
```

### State determination in `page.tsx`

```ts
// Use the existing getApiUrl() utility from @/src/utils/mock-api
// It reads NEXT_PUBLIC_USE_MOCK_API and routes to /ui-api/mock/... when true
import { getApiUrl } from '@/src/utils/mock-api'

const [statsRes, pipelinesRes] = await Promise.all([
  fetch(getApiUrl(`dashboard/stats${scenario ? `?scenario=${scenario}` : ''}`), { cache: 'no-store' }),
  fetch(getApiUrl(`dashboard/pipelines${scenario ? `?scenario=${scenario}` : ''}`), { cache: 'no-store' }),
])

const state: DashboardState = determineDashboardState(pipelinesRes.pipelines, statsRes.incidents)
```

The `scenario` query param is threaded from a `?scenario=` URL param on `/dashboard` (dev convenience only, not exposed in production nav).

---

## Modified Files

| File | Change |
|---|---|
| `src/app/(main)/page.tsx` | Both redirect targets (`/pipelines` and `/home`) changed to `/dashboard` |
| `src/app/(shell)/home/page.tsx` | Add `redirect('/dashboard')` at top of component |
| `src/app/(shell)/dashboard/page.tsx` | Add stats/incidents fetching; compute `DashboardState`; pass to client |
| `src/app/(shell)/dashboard/DashboardClient.tsx` | Rewrite to render state-based layout using new module components |

---

## Styling Notes

All components use CSS custom properties exclusively — no hardcoded hex. The dashboard requires several token values that already exist in `base.css`/`theme.css`. Any value from `dashboard.css` that doesn't map to an existing token must be added to `base.css` and `theme.css` before use.

Tokens confirmed to exist (from prior audit):
- `--color-orange-300: #ffa24b`
- `--color-green-500`, `--color-red-500`, `--color-yellow-400`, `--color-blue-500`
- `--color-gray-dark-100`, `--color-gray-dark-500`, `--color-gray-dark-700`, `--color-gray-dark-800`
- `--color-green-750`, `--color-red-750`, `--color-blue-750` (tinted backgrounds)
- `--color-orange-alpha-10`
- `--font-archivo`, `--font-family-body`

Tokens to add (values from design reference, not currently in token system):
- `--color-surface-card: #0a0a0d` — KPI cards, attention queue, chart cards, pipeline table
- `--color-surface-table-header: #0c0c10` — sticky table header row
- `--color-surface-row-hover: rgba(255,255,255,0.015)` — table/incident row hover

Add to `src/themes/base.css` (primitives `:root`) then reference via semantic tokens in `theme.css`.

Typography follows the existing scale (`title-1`, `body-2`, `caption-1`, etc.) where possible.

---

## Out of Scope for This Implementation

- Real-time data refresh / WebSocket subscription
- Env selector actually filtering metrics by environment
- Range selector actually changing the time window
- Pipeline table sorting
- "From template" and "Try with sample data" first-run paths (disabled, grayed)
- Footer links in the first-run card (external docs)
- "Open in observability →" link actually navigating to a scoped view
- Incident CTA actions (navigation targets TBD per incident type)
