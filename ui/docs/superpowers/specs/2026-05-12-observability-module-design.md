# Observability Module — Per-pipeline Metrics (M3) and Logs (M4) Design

**Date:** 2026-05-12
**Status:** Scope approved, ready for implementation planning
**Linear:** [ETL-1074](https://linear.app/glassflow/issue/ETL-1074), milestone M2 (target 2026-06-14)
**Prerequisite:** [ETL-1073](https://linear.app/glassflow/issue/ETL-1073) — bundles VictoriaMetrics + VictoriaLogs into the Helm chart
**Replaces:** [ETL-1014](https://linear.app/glassflow/issue/ETL-1014) (cancelled — no longer using a Go API proxy)

---

## 1. Context

GlassFlow ships VictoriaMetrics (VM) and VictoriaLogs (VL) bundled in the Helm chart as cluster-DNS-addressable services. The Next.js UI runs in-cluster and resolves those services server-side. This eliminates the previously-planned Go API proxy: the UI's Next.js server is the backend-for-frontend, calling VM/VL directly from API routes and forwarding results to the browser.

This document defines the UI work — what surfaces are built, with what primitives, in what phase, and why. It is the result of a brainstorming session that resolved five scope decisions; those decisions are recorded in §2 with reasoning so future work can revisit them when context changes.

The design references an 8-artboard mockup at `docs/claude_design_handovers/glassflow-revamp-reimagined/project/Observability Design.html` (O1–O8). The current code already covers significant chunks of the design vocabulary: `src/modules/observability/` contains `MetricsTab.tsx`, `LogsTab.tsx`, `LogsToolbar.tsx`, `MetricsToolbar.tsx`, `ChartCard.tsx`, `HeroCard.tsx`, `LogLine.tsx`, `LogInspectorDrawer.tsx`, `ContextClusterer.ts`. API routes at `/ui-api/pipelines/[id]/{metrics,logs,logs/stream}` already enforce `pipeline_id` scoping. This work is gap-closure on existing scaffolding, not a greenfield build.

---

## 2. Scope decisions (with reasoning)

| # | Decision | Choice | Reasoning |
|---|---|---|---|
| 1 | O8 Settings → Observability page | **Dropped** | Most of O8 (retention sliders, fan-out diagram, roadmap, "Edit defaults" modal) is decorative or technically impossible — VM has no runtime retention mutation API, disk-capacity denominators come from k8s PVCs not VM. The legitimate operational data (version, disk used, cardinality) is real but its audience is SREs reaching for `kubectl` / `vmui`, not product users. Replaced with a tiny status pill in the Metrics/Logs toolbars showing `internal stack · 1.4 GB · 7d` from Helm-supplied env vars. |
| 2 | Brushed-range pinning across panels | **B — drill-down only** | Full vision (drag-brush on any of 6 dashboard charts → all charts + logs follow) costs ~1–2 weeks and would require either replacing Recharts on the dashboard grid or layering a brittle SVG overlay. Drill-down-only captures ~70% of the user value (the "I see a spike, let me focus on that window" flow) at ~30% of the cost, and contains the custom-SVG primitive to one chart instead of six. The dashboard grid keeps the existing Recharts-based `ChartCard.tsx`. |
| 3 | DLQ peek panel on O1 (with Replay/Purge actions) | **A — full panel as designed** | DLQ viewer page is committed parallel work and Replay/Purge backend endpoints are planned. The panel is built against the real targets, not stubs. If backend deliverables slip, the buttons render as `disabled — coming soon` rather than blocking M2. |
| 4 | Drill-down chart rendering | **B — custom `OBChartSVG` primitive** | Recharts' `<Brush>` renders drag handles below the plot, not in-plot — fundamentally different UX from the design's drag-to-select shaded region. Hybrid (Recharts + SVG overlay) would require syncing pixel coordinates between two rendering systems. Custom SVG matches the design exactly and is reusable; cost is bounded to one chart, ~5 days for the primitive plus ~1 day for URL wiring. |
| 5 | Phasing | **B — M2-extended** | M2-strict (only what the ticket explicitly requires) would ship a regression-feeling release with no drill-down or DLQ peek. All-in for M2 carries real slip risk on backend dependencies. M2-extended ships the design's emotional core (brushed drill-down) within the June 14 window and defers the inspector/search deepening (O5, O6) to a Phase 2 that doesn't block M2. ~28 working days, fits in the 33-day window. |

Two smaller calls, folded into the design without separate decision turns:

- **O6 trace cross-link:** rendered as `disabled — coming soon` when a log line has a `trace_id` but no trace viewer exists yet; hidden entirely when no `trace_id` is present.
- **O5 "same shape" structural clustering:** reuses existing `ContextClusterer.ts` rather than building a new clusterer.

---

## 3. Module layout

The existing `src/modules/observability/` module remains the home base. Almost everything builds on or wraps it.

### Stays as-is or with light polish

| File | What it does today | What changes |
|---|---|---|
| `MetricsTab.tsx` | Orchestrates the dashboard grid | Polish to design vocabulary; add scope badge, status pill, NOTE banner; slot in DLQ peek panel |
| `LogsTab.tsx` + `useLogStream` | Live tail via SSE | Add filter pill row, footer telemetry, pinned-range chip surface |
| `ChartCard.tsx` / `HeroCard.tsx` | Recharts-based panels | Keep for dashboard grid; align labels, legends, deltas to design |
| `LogLine.tsx` / `LogInspectorDrawer.tsx` | Log rendering + detail drawer | Phase 2: cross-cutting links section in drawer |
| `ContextClusterer.ts` / `ContextExpander.tsx` | Log clustering for context expansion | Phase 2: drives "same shape" footer in O5 |
| `/ui-api/pipelines/[id]/metrics` | Proxies PromQL to VM with `pipeline_id` enforcement | Add helper for DLQ-peek LogsQL query |
| `/ui-api/pipelines/[id]/logs` + `/logs/stream` | Proxies LogsQL + SSE to VL | No structural changes |
| `src/components/ui/sparkline.tsx` | Mini sparkline primitive | Adopt for hero cards (currently unused per exploration) |

### New primitives — `src/modules/observability/primitives/`

| Primitive | Purpose |
|---|---|
| `OBChartSVG.tsx` | Custom SVG chart with line/area + crosshair + in-plot brush. Used on drill-down (O2) and mini-metrics strip (O5). Emits `onBrushChange(brushFrom, brushTo)`. |
| `ScopeBadge.tsx` | Orange `scoped: prod-orders-analytics-h8z9a` pill in toolbars |
| `StatusPill.tsx` | Toolbar chip — `internal stack · 1.4 GB · 7d` from Helm env vars |
| `PinnedRangeChip.tsx` | Orange `13:00–13:08 · from Metrics drill-down` chip in logs toolbar; × clears `pinnedFromRange` URL param |
| `DLQPeekPanel.tsx` | Bottom-right quadrant of O1; lists recent DLQ entries + counts + 3 action buttons |

### New surfaces

| Path | What it is |
|---|---|
| `app/(shell)/pipelines/[id]/metrics/[query]/page.tsx` | Extended for O2 (drill-down with brush, correlation panels, "Open Logs · pre-filtered") |
| `app/(shell)/pipelines/[id]/metrics/page.tsx` empty state | O7 disabled state when `NEXT_PUBLIC_INTERNAL_METRICS_ENABLED=false` |
| `app/(shell)/pipelines/[id]/logs/page.tsx` empty state | O7 disabled state when `NEXT_PUBLIC_INTERNAL_LOGS_ENABLED=false` |
| `app/(shell)/dlq/page.tsx` | DLQ viewer — **tracked as parallel deliverable**, not built by this design |

### Touches outside the observability module

| File | Change |
|---|---|
| `src/app/ui-api/config.ts` | Add `getVictoriaMetricsUrl()`, `getVictoriaLogsUrl()`, `getInternalMetricsEnabled()`, `getInternalLogsEnabled()` helpers |
| `src/observability/config.ts` | Extend `loadObservabilityConfig()` to read the four new chart-injected env vars; expose on singleton |
| `src/themes/base.css` + `theme.css` | Add five component-color tokens (see §5) and one new orange-pinned-range surface token |

---

## 4. URL state model and cross-surface range pinning

State lives in URL params, not Zustand or React context. Every state is deep-linkable, shareable in Slack, and survives refresh. The single source of truth is the URL, parsed once per page by a small `useObservabilityRange()` hook.

### Shared range params (both Metrics and Logs tabs)

```
?from=<ISO8601>&to=<ISO8601>&range=<preset>
```

- `range` ∈ `{15m, 1h, 6h, 24h, 7d, custom}` — toolbar preset
- For non-`custom` presets, `from`/`to` are derived (`to = now`, `from = now - preset`) and not stored in the URL; auto-refresh ticks `to` forward
- Toolbar range picker reads + writes these params

### Drill-down-specific params (`metrics/[query]` only)

```
?from=...&to=...&brushFrom=<ISO8601>&brushTo=<ISO8601>
```

- `brushFrom`/`brushTo` are the in-plot brush selection; subset of `from`/`to`
- `OBChartSVG` renders the orange shaded region between them
- "Clear brush" on the drill-down toolbar drops both params

### Cross-pinning param (drill-down → logs navigation)

```
/pipelines/[id]/logs?from=...&to=...&pinnedFromRange=metrics-drilldown
```

- `pinnedFromRange=metrics-drilldown` tells the logs page to render `PinnedRangeChip`
- The chip's × button removes `pinnedFromRange` and resets `range` to `1h` default
- O5 (Phase 2) reads `from`/`to` to query VM for the mini-metrics-strip context

### Flow walkthrough

1. User on `/pipelines/abc/metrics` (`?range=1h`). Sees a spike in `Records ingested`.
2. Clicks the chart → `/pipelines/abc/metrics/records-ingested?range=1h`.
3. Drags brush from 13:00 → 13:08. URL: `?range=1h&brushFrom=13:00&brushTo=13:08`. Correlation panels (latency p99, logs-in-range) refilter.
4. Clicks "Open Logs · pre-filtered" → `/pipelines/abc/logs?from=13:00&to=13:08&pinnedFromRange=metrics-drilldown`.
5. Logs tab renders pinned-range chip, queries VL with the window, mini-metrics strip queries VM with the same window (Phase 2).

### Why URL state, not Zustand

- Survives refresh; survives back/forward
- Shareable: paste the URL into Slack, get the same incident view
- Avoids hydration race conditions with `coreStore.setTopicCount` (which the pipeline wizard already requires)
- Single source of truth: no slice ↔ URL synchronization bugs

---

## 5. Chart primitives — Recharts + OBChartSVG

Two chart implementations live side-by-side. They render the same `series` shape (`{ts, value}[]` + `color` token) but have different capabilities.

### Recharts — dashboard grid (O1) and sparklines

- 6 chart cards on the metrics dashboard
- Sparklines on hero cards via existing `src/components/ui/sparkline.tsx`
- Existing `ChartCard.tsx` wraps; polish to match design's lean monospace aesthetic (mono axis labels, value-in-legend format, subtle tooltip)
- No brush, no custom crosshair beyond Recharts' built-in tooltip dot

### OBChartSVG — drill-down (O2) and mini-metrics strip (O5, Phase 2)

- One reusable primitive at `src/modules/observability/primitives/OBChartSVG.tsx`
- Props: `series[]`, `yMax`, `yMin`, `width`, `height`, `pad`, `showBrush`, `brushFrom`, `brushTo`, `onBrushChange`, `showCrosshair`, `crosshairAt`
- Renders: gridlines, axis labels, line + optional area fill, dashed reference series, crosshair (dashed vertical line on hover), brush region (shaded orange rectangle with drag handles)
- Interactions:
  - mousedown on plot area → start new selection
  - mousedown on existing handle → resize
  - click outside brush → clear
  - keyboard arrows when focused → nudge by ±1 step
- Emits `onBrushChange(brushFrom, brushTo)`; parent serializes to URL

### Component color tokens (new)

The design uses a 5-color component palette that doesn't exist in the current token system. Add to `src/themes/base.css` and `theme.css`:

| Token | Approximate value | Source |
|---|---|---|
| `--color-component-ingestor` | `rgb(101, 165, 245)` (blue-500) | Maps to existing `--color-blue-500` |
| `--color-component-processor` | `rgb(232, 145, 89)` (orange-300) | Maps to existing `--color-orange-300` |
| `--color-component-sink` | `rgb(102, 198, 132)` (green-500) | Maps to existing `--color-green-500` |
| `--color-component-api` | `rgb(180, 180, 195)` | New, neutral gray |
| `--color-component-ui` | `rgb(120, 120, 132)` | New, darker neutral gray |

Also add one new surface token for the pinned-range chip:

| Token | Value |
|---|---|
| `--surface-pinned-range-bg` | `color-mix(in srgb, var(--color-orange-300) 6%, transparent)` |
| `--surface-pinned-range-border` | `color-mix(in srgb, var(--color-orange-300) 35%, var(--surface-border))` |

After adding, run `pnpm sync-tokens` per CLAUDE.md §7.

---

## 6. Surface-by-surface scope

### Phase 1 — must ship by 2026-06-14 (M2 deadline)

#### O1 Metrics dashboard

Polish + augment existing `MetricsTab.tsx`.

- **Toolbar:** range picker (existing, polish) · component filter pills · scope badge · auto-refresh control (user-facing dropdown: `off · 15s · 30s · 60s`, default `30s`, selection persisted to `localStorage` key `obs.autoRefreshInterval.v1`) · status pill (`internal stack · 1.4 GB · 7d` from Helm env vars)
- **Hero cards:** 3 cards (records ingested, p99 latency, DLQ rate) with sparklines + delta vs previous period
- **Chart grid:** 2-up, 3 rows. Each panel shows PromQL metric name in subtitle, value + delta in top-right, legend with current value at bottom
  - Records ingested · by component (area + lines per component)
  - Records written · sink (with ingest reference dashed line)
  - Processing latency · p50 / p95 / p99 (three quantile lines)
  - Dead-letter rate (single red line)
  - Bytes/sec · ingest (area)
  - DLQ peek panel (see below)
- **NOTE banner:** orange-tinted, bottom, explains `pipeline_id` scoping enforcement. Dismissible; persisted to `localStorage` key `obs.scopingNoteDismissed.v1`
- **Data:** existing `/ui-api/pipelines/[id]/metrics` route; query catalog updates in `canonicalDashboard.ts` to align metric names with backend (see §9 risk)

#### O2 Drill-down with brush

Extend `metrics/[query]/page.tsx`.

- Breadcrumb · page title · `Back to grid` · range picker · component filter
- Big chart via `OBChartSVG`: 1580px wide, 320px tall, with crosshair on hover and in-plot brush
- Tooltip near crosshair: timestamp + all series values + derived calculations (e.g., processor lag)
- Brush label anchored to selection: `13:00–13:08 · selected`
- Below the chart, two correlation panels:
  - **Latency p99 · same range** — small chart filtered to the brushed window
  - **Logs in this range** — component breakdown bars (error % red, warn % yellow, info % component color)
- Two buttons in the correlation footer:
  - **Open Logs · pre-filtered** → routes to logs tab with `from`/`to`/`pinnedFromRange=metrics-drilldown`
  - **Copy LogsQL** → copies the LogsQL query that the logs panel will run

#### O3 States (loading / no-data / retention-edge / query-error)

Drop-in card frames for `ChartCard` and `OBChartSVG`. All four states reuse the same card frame — no layout reflow.

- **Loading:** animated shimmer over gridlines + centered spinner + `querying VictoriaMetrics…` label
- **No-data:** diagonal hatch pattern background + dashed border + `No samples in window yet · pipeline started Ns ago`
- **Retention-edge:** striped left region (% width = outside-retention portion) + dashed right border + `← outside retention (7d default)` label
- **Query-error:** red-tinted border + error summary + `Retry now` + `Copy query` buttons + auto-retry countdown

#### O4 Live tail

Polish existing `LogsTab.tsx`.

- Toolbar: range picker · live/paused indicator (with rate) · pause-stream · jump-to-bottom · wrap-lines · show-JSON · status pill
- Search head: search input (LogsQL) + Saved queries + Export
- Filter pill row: component pills (5, with live counts) + severity pills (4: debug, info, warn, error, with live counts)
- Logs body: severity left-stripe color coding (error red, warn yellow) · monospace · structured field syntax (`key=value`)
- Footer: live indicator · line count · warn/error counts · VL retention info

#### O7 Disabled / BYO state

New empty state component used by both `MetricsTab` and `LogsTab` when their respective flag is off.

- Renders inside the tab body when `NEXT_PUBLIC_INTERNAL_METRICS_ENABLED=false` (metrics) or `NEXT_PUBLIC_INTERNAL_LOGS_ENABLED=false` (logs)
- Gray status badge: `internal observability is OFF`
- Heading + description explaining BYO backend mode
- CTAs:
  - **Enable internal observability…** → docs link
  - **Open in your Grafana →** → only rendered if `NEXT_PUBLIC_EXTERNAL_GRAFANA_URL` is set (new optional env var, added to chart `ui-configmap.yaml`; deployments without BYO Grafana simply don't set it and the button is hidden)
  - **Read the docs** → docs link
- Helm snippet showing the values to enable (rendered as styled `<pre>`)
- Grayed placeholder cards (opacity 0.55, hatched fills) hinting at what will appear when enabled

#### DLQ peek panel

New `DLQPeekPanel.tsx` occupying O1's bottom-right quadrant.

- Header: `47 msgs · 1h · 12 unconsumed` (counts from LogsQL)
- 4 most-recent DLQ entries: `timestamp · COMPONENT · reason · ×count`
- Three buttons:
  - **Open DLQ viewer** → `/dlq?pipeline=<id>&from=...&to=...`
  - **Replay…** → confirmation modal, then POST to backend Replay endpoint (parallel deliverable)
  - **Purge…** → confirmation modal with destructive styling, then POST to backend Purge endpoint (parallel deliverable)
- Data source: LogsQL `service.namespace:pipeline-<id> AND _stream:dlq | last 100`, polled every 30s
- Replay/Purge render as `disabled — coming soon` when their backend endpoints are unavailable. Detection mechanism: the UI does a one-time HEAD request to the endpoints on first DLQ panel render; 404 → button disabled, 200/405 → enabled. Result cached in `sessionStorage` to avoid repeated probes.

### Phase 2 — post-M2

#### O5 Logs search + context expansion + range correlation

- **Pinned-range chip** in toolbar when `pinnedFromRange` URL param present
- **Mini metrics strip** above logs body — small VM query showing throughput in the pinned range (renders via `OBChartSVG` with brush region overlay)
- **Search input** with LogsQL + live match count + saved-query dropdown + "Find similar"
- **Context-expansion rows** powered by `ContextClusterer.ts`: `show 5 lines before` / `show 5 lines after` / `jump to trace_id <id>`
- **Gap collapse rows:** `· 8 lines collapsed · click to expand ·`
- **Footer:** "same shape" cluster summary (e.g., `38 matches · all in 13:00–13:08 · same shape: order_total · float64 → string`) + `Open root cause in Library →` link

#### O6 Inspector drawer

Extend existing `LogInspectorDrawer.tsx`.

- Drawer head: severity badge · component · timestamp · close
- Error summary box: monospace, color-coded fields (error type, expected, received, key)
- Structured fields grid: two-column key/value layout, dashed dividers, error fields in red, `trace_id` in orange
- **Cross-cutting links section** (small caps label `CROSS-CUTTING LINKS`):
  - **Schema** → `/library/schemas/<schema_id>` (Library target exists)
  - **Trace** → conditional: rendered as `disabled — coming soon` if `trace_id` present but no trace viewer exists; hidden entirely if no `trace_id`
  - **DLQ** → `/dlq?pipeline=<id>&trace_id=<id>` (planned target)
- Actions: `Find similar (N)` · `Pin to range` · `Copy LogsQL` · `Open in DLQ`

### Parallel deliverables (not built by this design)

- **DLQ viewer page** (`/dlq`) — built by whoever owns the DLQ backend; this design plans for it to exist but doesn't define its UI
- **Replay / Purge backend endpoints** — UI wires confirmation modals + optimistic feedback once endpoints land; if delayed, buttons render `disabled — coming soon`

---

## 7. API surface

### Existing — keep as-is (with minor query catalog updates)

| Route | Method | Purpose |
|---|---|---|
| `/ui-api/pipelines/[id]/metrics` | GET | Proxies PromQL to VM with `{pipeline_id="<id>"}` enforcement. Params: `query` (canonical key), `rawQuery`, `from`, `to`, `step`. |
| `/ui-api/pipelines/[id]/logs` | GET | Proxies LogsQL to VL with `pipeline_id:"<id>"` enforcement. Params: `query`, `from`, `to`, `limit`. |
| `/ui-api/pipelines/[id]/logs/stream` | GET (SSE) | Live tail via SSE. |
| `/ui-api/observability/stack` | GET | Stack telemetry (status pill source). |

### New helpers in `canonicalDashboard.ts`

The canonical query dictionary needs to be updated to match the metric names that the backend actually emits (TBD — see §9). Each canonical key maps to a PromQL query template:

```ts
recordsIngested: 'sum by (pipeline_id) (rate(<actual_metric>{pipeline_id="$id"}[5m]))'
recordsWrittenSink: '...'
processingLatencyP99: 'histogram_quantile(0.99, sum by (le) (rate(<actual_metric>_bucket{pipeline_id="$id"}[5m])))'
dlqRate: 'sum by (pipeline_id) (rate(<actual_metric>{pipeline_id="$id"}[5m]))'
bytesIngested: '...'
streamDepthRatio: '<actual_metric>{pipeline_id="$id"}'
```

### New: DLQ peek query

The DLQ peek panel uses a LogsQL query through the existing logs proxy:

```
service.namespace:pipeline-<id> AND _stream:dlq | last 100
```

Parsed client-side into the recent-entries list + counts. No new API route required.

---

## 8. Testing strategy

| Layer | What | How |
|---|---|---|
| **Unit** | New primitives (`OBChartSVG`, `ScopeBadge`, `StatusPill`, `PinnedRangeChip`, `DLQPeekPanel`) | Vitest + RTL; render-with-props snapshots + interaction tests for brush mousedown/move/up |
| **Unit** | `useObservabilityRange()` hook | Vitest; parse/serialize URL params, range preset → `from`/`to` derivation, custom-range handling |
| **Integration** | URL state across navigation (drill-down → logs) | Vitest + Next.js router mock; assert `pinnedFromRange` propagation |
| **Integration** | API routes (`/metrics`, `/logs`, `/observability/stack`) | Vitest; mock `fetch` to VM/VL, assert `pipeline_id` scoping enforced server-side, assert response shape |
| **Visual / manual** | Brush UX, live tail SSE, NOTE banner dismissal, disabled state rendering | Manual test plan in PR description, screenshots in PR |
| **Smoke** | Full pipeline detail page renders with all observability surfaces against mock backend | Happy path through whatever e2e framework the repo standardizes on (verify before implementing): load `/pipelines/abc/metrics`, drill into a panel, brush, navigate to logs, verify chip. If no e2e framework exists, defer to manual test plan in PR. |

Notes on what's **not** in the testing strategy:
- No load testing of VM/VL — out of scope per ETL-1074
- No e2e tests against real VM/VL — covered by Helm/integration tests on the chart side

---

## 9. Risks and open questions

| Risk | Severity | Mitigation |
|---|---|---|
| **Metric names in design don't match ticket's PromQL catalog** | Medium | The design uses `gfm_records_ingested_total`, etc. The ticket lists `gfm_ingestor_consumed_total`, `gfm_sink_written_total`, `gfm_*_duration_seconds`, `gfm_*_dlq_total`. Backend is authoritative. Resolution: confirm canonical names against actual emitted metrics in `gfm_app_*` or query `/api/v1/label/__name__/values` against a live VM; update `canonicalDashboard.ts` before implementing the drill-down. |
| **Trace cross-link has no destination** | Low | Rendered as `disabled — coming soon` when `trace_id` present, hidden otherwise. Wire up when tracing surface lands. |
| **DLQ viewer page slip** | Medium | DLQ peek panel's `Open DLQ viewer` button targets `/dlq` which is built in parallel by another work stream. If it slips, the button can route to a placeholder or be disabled. Surface this risk in M2 status updates. |
| **Replay/Purge backend slip** | Medium | Buttons render `disabled — coming soon` when endpoints unavailable. UI ships without them; wire up when they exist. |
| **Recharts limitations on dashboard grid** | Low | The design's lean aesthetic (mono labels, subtle area fills, no chart chrome) requires Recharts customization. Some polish loss is acceptable on the grid (it's the at-a-glance view); the drill-down uses `OBChartSVG` which matches exactly. |
| **Polling 30s × 6 charts** | Low | 6 panels × 1 query each × 30s polling × N concurrent users. VM/VL handle their own load (per ETL-1074 "Out of scope"). Revisit only if dashboards trigger noticeable spikes. |
| **VL SSE connection stability across browser sleep / network blips** | Medium | Existing `useLogStream` should already handle reconnect; verify under flaky-network conditions before M2 ship. |

### Open questions to resolve before implementation

1. What are the **actual metric names** emitted by the backend? (Drives `canonicalDashboard.ts`.)
2. Is there an **external Grafana URL** convention for BYO mode? (Drives whether `Open in your Grafana →` CTA renders on O7.)
3. What's the **DLQ event shape in VL logs**? Specifically: is `_stream:dlq` a real stream identifier, or do DLQ events use a different label/field? (Drives the LogsQL query in DLQ peek.)
4. What's the **backend Replay endpoint contract**? Single-message replay vs. bulk-by-trace-id vs. bulk-by-time-window? (Drives the confirmation modal copy + form.)

These don't block scoping but must be answered before the relevant components are implemented.

---

## 10. Out of scope

Explicitly **not** built by this design:

- **O8 Settings → Observability page** (dropped per §2.1)
- **Brush on dashboard grid** (deferred per §2.2; drill-down only)
- **Authentication / multi-tenancy enforcement** at the UI layer — per ETL-1074, the Next.js layer becomes the trust boundary but actual auth is a separate problem (T12 §1)
- **Exposing VM/VL via Ingress** for direct browser access (not needed; not desired)
- **Caching / rate-limiting** between UI and VM/VL — VM/VL handle their own load
- **Long-term metric retention** beyond M1's 7d (metrics) / 3d (logs)
- **Cluster-wide metrics aggregation** — pipeline-scoped only
- **DLQ viewer page UI** (parallel deliverable, separate ticket)
- **Replay / Purge backend endpoints** (parallel deliverable, separate ticket)
- **Trace viewer UI** (no current surface; cross-link disabled until it exists)

---

## 11. Implementation references

| Topic | File |
|---|---|
| Design mockup (8 artboards) | `docs/claude_design_handovers/glassflow-revamp-reimagined/project/Observability Design.html` |
| Existing observability module | `src/modules/observability/` |
| Existing API routes | `src/app/ui-api/pipelines/[id]/{metrics,logs,logs/stream}/route.ts` |
| Config helpers | `src/app/ui-api/config.ts`, `src/observability/config.ts` |
| Token system rules | `CLAUDE.md` §1–§7, `docs/architecture/DESIGN_SYSTEM.md` |
| Token sync (after adding new tokens) | `pnpm sync-tokens` |
| Component architecture | `.cursor/architecture/COMPONENT_ARCHITECTURE.md` |
| State management (Zustand patterns) | `.cursor/architecture/STATE_MANAGEMENT.md` |

---

## 12. Estimated effort (Phase 1)

Calendar: 2026-05-12 to 2026-06-14 = ~22 working days. Phase 1 budget breakdown (calendar days for one engineer, sequential):

| Workstream | Days |
|---|---|
| New tokens, status pill, scope badge, NOTE banner | 2 |
| O1 polish (existing `MetricsTab`, hero card sparklines, query catalog updates) | 3 |
| O3 states (loading, no-data, retention-edge, error) shared across chart types | 2 |
| O4 polish (existing `LogsTab`, filter pill row, footer) | 2 |
| O7 disabled state for both tabs | 2 |
| DLQ peek panel | 2 |
| `OBChartSVG` primitive (lines, area, axes, crosshair, brush, drag interactions, keyboard) | 5 |
| O2 drill-down page (correlation panels, cross-pinning URL plumbing) | 3 |
| `useObservabilityRange()` hook + URL serialization | 1 |
| Testing (unit, integration, smoke) | 3 |
| **Subtotal** | **25** |
| Buffer for review, polish, integration | ~3 |
| **Total** | **~28 working days** |

This is **tight** for the 22-day window. Mitigations:
- O7 disabled state and DLQ peek are independent and can parallelize if a second engineer is available
- Token work (~2 days) can start before scope decisions are finalized
- Phase 2 work (O5, O6) explicitly out of scope for M2 — do not pull forward

---

**End of design document.**
