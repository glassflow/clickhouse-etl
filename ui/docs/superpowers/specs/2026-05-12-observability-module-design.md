# Observability Module — Per-pipeline Metrics (M3) and Logs (M4) Design

**Date:** 2026-05-12 (revised same day after code audit)
**Status:** Scope approved, ready for implementation planning
**Linear:** [ETL-1074](https://linear.app/glassflow/issue/ETL-1074), milestone M2 (target 2026-06-14)
**Prerequisite:** [ETL-1073](https://linear.app/glassflow/issue/ETL-1073) — bundles VictoriaMetrics + VictoriaLogs into the Helm chart
**Replaces:** [ETL-1014](https://linear.app/glassflow/issue/ETL-1014) (cancelled — no longer using a Go API proxy)

> **Revision note:** This spec was originally written before a thorough audit of `src/modules/observability/`. The audit revealed that the module is much further along than the first exploration reported — most of what was framed as "new" already exists. Sections §3 (module layout), §4 (state model), §5 (chart primitives), §6 (surface scope) and §12 (effort) reflect the audit. Decisions in §2 are unchanged. The "original" view is preserved in git history (commit `3b150bf`).

---

## 1. Context

GlassFlow ships VictoriaMetrics (VM) and VictoriaLogs (VL) bundled in the Helm chart as cluster-DNS-addressable services. The Next.js UI runs in-cluster and resolves those services server-side. This eliminates the previously-planned Go API proxy: the UI's Next.js server is the backend-for-frontend, calling VM/VL directly from API routes and forwarding results to the browser.

This document defines the remaining UI work for M2 — what gets polished, what gets added, in what phase, and why. The 8-artboard mockup at `docs/claude_design_handovers/glassflow-revamp-reimagined/project/Observability Design.html` (O1–O8) is the design source. The existing observability module already covers most of the structural work; what's left is filling specific gaps and polishing for design-vision parity.

---

## 2. Scope decisions (with reasoning)

| # | Decision | Choice | Reasoning |
|---|---|---|---|
| 1 | O8 Settings → Observability page | **No new work** (revised from "dropped") | The audit found O8 already exists: `/observability` and `/workspace/observability` routes wired to `ObservabilityLandingClient` composing `StackAdminPanel`, `CardinalityTable`, `FanOutDiagram`, `RetentionBar`, `M3M4M5Roadmap`. Phase 1 leaves it untouched. A status pill is still added to the Metrics/Logs toolbars so the most common operational signals are visible in-context (toolbar audience differs from /workspace/observability audience). |
| 2 | Brushed-range pinning across panels | **B — drill-down only** | Original decision: brush on drill-down only, not on the 6-up dashboard. **Audit shows the dashboard already has brush** via `ChartCard.onMouseDown/Move/Up` calling `observabilityStore.pinBrushedRange`. Since the dashboard brush is already shipped and working, we keep it. The drill-down chart needs a more polished brush UX (visible crosshair, handles, brush label) to match the design's drill-down treatment — this is `OBChartSVG`'s job. |
| 3 | DLQ peek panel on O1 (with Replay/Purge actions) | **A — full panel** | The standalone `DLQViewer` already exists with consume/purge wired to backend endpoints. Phase 1 adds the *peek* panel slotted into the dashboard grid that reuses the same backend hooks. |
| 4 | Drill-down chart rendering | **B — `OBChartSVG` primitive** | The dashboard `ChartCard` uses Recharts with `ReferenceArea` for brush feedback — functional but visually plain. The drill-down view is the "I'm investigating an incident" surface where UX quality matters most. `OBChartSVG` is a focused replacement just for the drill-down: in-plot brush with handles, dashed-line crosshair on hover, tooltip box, brush label. ~5 days for the primitive plus ~1 day to wire it into `DrillDownView`. |
| 5 | Phasing | **B — M2-extended** | Phase 1 ships the design's emotional core (component breakdown + polished drill-down + DLQ peek) within the June 14 window. Phase 2 (search-with-context UX deepening + inspector cross-links) ships post-M2. Phase 1 scope is much smaller than originally estimated — see §12. |

Two smaller calls, folded into the design without separate decision turns:

- **O6 trace cross-link** (Phase 2): rendered as `disabled — coming soon` when a log line has a `trace_id` but no trace viewer exists yet.
- **O5 "same shape" structural clustering** (Phase 2): reuses existing `ContextClusterer.ts`.

---

## 3. Module layout — what exists, what's added

### Already built (preserve, possibly polish)

| Path | What it does | Phase 1 touch |
|---|---|---|
| `src/modules/observability/MetricsTab.tsx` | 3-up hero cards + 3-up chart grid via `HERO_CARDS` + `CHART_GRID` | Add component filter, NOTE banner, DLQ peek slot, optionally restructure to 2-up |
| `src/modules/observability/MetricsToolbar.tsx` | `ScopeBadge` + `BrushedRangePill` + `Switch` auto-refresh + `TimeRangePicker` + custom modal | Add component filter pills + status pill |
| `src/modules/observability/LogsTab.tsx` | Live tail + range-mode auto-switch + URL state + `FilterPillRow` + inspector | None for Phase 1 (Phase 2 work on context expansion + footer) |
| `src/modules/observability/LogsToolbar.tsx` | `ScopeBadge` + `LiveIndicator` + `BrushedRangePill` + LogsQL search + `TimeRangePicker` | Add status pill |
| `src/modules/observability/ChartCard.tsx` | Recharts `LineChart` with Recharts `ReferenceArea` brush wired to `observabilityStore.pinBrushedRange`. **Only renders `series[0]`.** | Upgrade to multi-series (component breakdown) |
| `src/modules/observability/ChartFrame.tsx` | Layout-stable wrapper with `loading | empty | error | populated` states + Skeleton | No change |
| `src/modules/observability/HeroCard.tsx` | Value + delta + `Sparkline` (already integrated) | No change |
| `src/modules/observability/DrillDownView.tsx` | Bare Recharts `LineChart`, multi-component pivot, back-to-metrics link, "Open logs in range" link | Major upgrade: `OBChartSVG`, brush handlers, correlation panels |
| `src/modules/observability/DLQViewer.tsx` | Standalone DLQ page with consume/purge against `/ui-api/pipeline/[id]/dlq/*` | No change (peek panel reuses its data hooks) |
| `src/modules/observability/BrushedRangePill.tsx` | Pinned-range chip with × clearing, sourced from `observabilityStore.brushedRange` | No change |
| `src/modules/observability/DisabledState.tsx` | O7 BYO state with helm snippet, ghost frames, external Grafana link | No change |
| `src/modules/observability/FilterPillRow.tsx` | Reusable severity/component filter pills | Reuse for metrics component filter |
| `src/modules/observability/canonicalDashboard.ts` | `HERO_CARDS` (3) + `CHART_GRID` (6) | Adjust grid to make room for DLQ peek; possibly update titles for design parity |
| `src/store/observability.store.ts` | Zustand slice: `rangeKey`, `customRange`, `brushedRange`, `autoRefresh` + actions | Add `autoRefreshIntervalMs` (replacing on/off toggle) |
| `src/components/ui/scope-badge` | `<ScopeBadge pipelineId="…" />` | No change |
| `src/components/ui/sparkline` | Mini sparkline | No change |
| `src/components/ui/time-range-picker` | Preset + custom picker with `DEFAULT_RANGES` | No change |
| `src/components/ui/live-indicator` | Pulsing dot + label | No change |
| O8 cluster (`ObservabilityLandingClient`, `StackAdminPanel`, `CardinalityTable`, `FanOutDiagram`, `RetentionBar`, `M3M4M5Roadmap`) at `/observability` and `/workspace/observability` | Already shipped | Untouched |

### New for Phase 1

| Path | What it is |
|---|---|
| `src/modules/observability/primitives/OBChartSVG.tsx` | Custom SVG chart with line/area + crosshair + in-plot brush with handles + brush label. **Used only in `DrillDownView`** for the polished drill-down UX. |
| `src/modules/observability/StatusPill.tsx` | Toolbar chip: `internal stack · 1.4 GB · 7d` reading from helm-supplied env vars |
| `src/modules/observability/ScopingNoteBanner.tsx` | Orange dismissible note explaining `pipeline_id` scoping; `localStorage` key `obs.scopingNoteDismissed.v1` |
| `src/modules/observability/MetricsComponentFilter.tsx` | Component filter pills row for the metrics toolbar (wraps `FilterPillRow`); selection persisted as `?comp=` URL param |
| `src/modules/observability/DLQPeekPanel.tsx` | Compact DLQ peek for the dashboard: recent entries + counts + "Open DLQ viewer" + Replay/Purge (reusing `DLQViewer`'s endpoints) |
| `src/modules/observability/AutoRefreshControl.tsx` | Dropdown replacing the current Switch: `off · 15s · 30s · 60s`, persists to `localStorage` key `obs.autoRefreshIntervalMs.v1` |
| `src/app/ui-api/observability/stack/route.ts` (extend) | Add disk-usage + version fields needed by status pill (if not already present in current route — verify on implementation) |

### Touched outside the module

| File | Change |
|---|---|
| `src/observability/config.ts` | Add reads for `NEXT_PUBLIC_INTERNAL_METRICS_URL` and `NEXT_PUBLIC_INTERNAL_LOGS_URL` (the four ETL-1074 env vars — verify which are already plumbed) |
| `src/app/ui-api/config.ts` | Helpers `getVictoriaMetricsUrl()`, `getVictoriaLogsUrl()` if not yet present |
| `src/themes/base.css` + `theme.css` | No new tokens — `--obs-chart-*` and `--obs-severity-*` already exist. Add only `--surface-pinned-range-bg` if `BrushedRangePill` styling needs tightening to match the orange-bordered design |

---

## 4. State model

State lives in two layers depending on lifetime:

### Zustand — `observabilityStore` (already built)

Used for state that needs to be observed by multiple components in the same page:

```ts
{
  rangeKey: '15m' | '1h' | '6h' | '24h' | '7d' | 'custom'
  customRange: { fromMs: number; toMs: number } | null
  brushedRange: { fromMs: number; toMs: number; source: 'metrics_drill_down' | 'logs' } | null
  autoRefresh: boolean                       // [Phase 1 change] becoming autoRefreshIntervalMs: number | null
}
```

**Phase 1 changes:**
- Replace `autoRefresh: boolean` with `autoRefreshIntervalMs: number | null` (`null` = off)
- Update consumers (`useMetricsQuery` polling) accordingly

### URL params — already built via `useUrlState` / `useUrlStateArray`

Used for state that should survive refresh and be shareable:

| Param | Set by | Read by |
|---|---|---|
| `?range=15m\|1h\|6h\|24h\|7d` | `MetricsToolbar` on preset click | `MetricsToolbar` initial mount syncs to store |
| `?q=<logsql>` | `LogsToolbar` on ⌘+Enter | `LogsTab` |
| `?sev=info,warn` | `FilterPillRow` toggle in logs | `LogsTab` |
| `?comp=ingestor,processor` | `FilterPillRow` toggle in logs | `LogsTab` |
| `?comp=ingestor,processor` (new for metrics) | `MetricsComponentFilter` toggle | `MetricsTab` |

**Cross-pinning flow** (already works):
1. User drags brush in `ChartCard` (dashboard) or `OBChartSVG` (drill-down) → `observabilityStore.pinBrushedRange(range, 'metrics_drill_down')`
2. `BrushedRangePill` in toolbar shows pinned range
3. User navigates to `/pipelines/[id]/logs` (any route, the pin is in store)
4. `LogsTab` checks `observabilityStore.brushedRange` — if set, suspends SSE live tail and switches to range-query mode via `useLogsQuery`
5. User clicks × on `BrushedRangePill` → `clearBrushedRange()` → logs returns to live tail

The cross-pinning flow doesn't need URL params because the store survives in-tab navigation. URL state would be needed only for sharing the pinned range via a link, which is not a Phase 1 requirement.

---

## 5. Chart primitives — Recharts coexists with `OBChartSVG`

Two chart implementations live side-by-side.

### Recharts — dashboard grid (already built)

- `ChartCard` for the 6 dashboard panels
- `HeroCard` uses `Sparkline` (custom primitive) inside `ChartFrame`
- Brush via `onMouseDown/Move/Up` + `ReferenceArea` for visual feedback — already wired to `observabilityStore.pinBrushedRange`
- **Phase 1 upgrade:** `ChartCard` currently renders only `series[0]`. Upgrade to render all series in the response, colored by `metric.component` label using `--obs-chart-{ingestor,processor,sink}` tokens

### OBChartSVG — drill-down only (new)

- One reusable primitive at `src/modules/observability/primitives/OBChartSVG.tsx`
- Used in `DrillDownView` for the polished single-chart drill experience
- Renders: gridlines, mono axis labels, one or more lines with optional area fill, dashed reference series, hover crosshair (dashed vertical line + tooltip box anchored to data), brush region with explicit drag handles, brush label
- Props (target API):

  ```ts
  type OBChartSVGProps = {
    series: { id: string; color: string; points: Array<[ms: number, v: number]>; dashed?: boolean; fill?: string }[]
    yMax?: number
    yMin?: number
    width?: number
    height?: number
    pad?: { l: number; r: number; t: number; b: number }
    showCrosshair?: boolean
    showBrush?: boolean
    brushFromMs?: number | null
    brushToMs?: number | null
    onBrushChange?: (fromMs: number, toMs: number) => void
    onBrushClear?: () => void
  }
  ```
- Interactions:
  - mousedown on plot area → start new selection
  - mousedown on existing handle → resize
  - click outside brush → clear (calls `onBrushClear`)
  - keyboard arrows when focused → nudge by ±1 step (accessibility)
- Emits `onBrushChange(fromMs, toMs)`; `DrillDownView` calls `observabilityStore.pinBrushedRange(range, 'metrics_drill_down')`

### Tokens

No new tokens required. The audit found `--obs-chart-{ingestor,processor,sink,grid,axis}` and `--obs-severity-{debug,info,warn,error,fatal}` already exist. Add `--surface-pinned-range-bg` and `--surface-pinned-range-border` only if `BrushedRangePill`'s current styling falls short of the design's orange-bordered chip — verify visually before adding.

---

## 6. Surface-by-surface scope

### Phase 1 — must ship by 2026-06-14 (M2 deadline)

#### O1 Metrics dashboard

Existing: `MetricsTab.tsx` + `MetricsToolbar.tsx` + `HeroCard.tsx` + `ChartCard.tsx` already in place.

Phase 1 changes:
- **Toolbar:** add `<MetricsComponentFilter />` + `<StatusPill />` to existing toolbar slots; replace `Switch` with `<AutoRefreshControl />` (dropdown: `off · 15s · 30s · 60s`)
- **NOTE banner:** render `<ScopingNoteBanner />` once per session (or until dismissed), positioned below the toolbar
- **Multi-series `ChartCard`:** render all series in response by component, not just `series[0]`
- **Grid layout:** restructure to slot DLQ peek into bottom-right. Either keep 3-up grid and add a 7th cell, or convert to 2-up grid per design — TBD during implementation, defer to design instinct
- **DLQ peek slot:** render `<DLQPeekPanel pipelineId={id} />` in the freed cell

#### O2 Drill-down with brush

Existing: `DrillDownView.tsx` is bare — single Recharts `LineChart`, "Open logs in range" link.

Phase 1 changes:
- Replace Recharts `LineChart` with `<OBChartSVG />`
- Wire brush handlers to `observabilityStore.pinBrushedRange` with source `'metrics_drill_down'`
- Add correlation panels below the big chart:
  - **Latency p99 · same range** — `ChartCard` filtered to the brushed window via prop
  - **Logs in this range** — small component breakdown panel (count of error/warn lines per component for the brushed window, queried via `useLogsQuery`)
- "Open Logs · pre-filtered" remains a `<Link>` — no extra wiring needed since `observabilityStore.brushedRange` is already consumed by `LogsTab`
- Add "Clear brush" affordance + "Copy LogsQL" button (composes the LogsQL query for the current brush window)

#### O3 States

Existing: `ChartFrame` already handles `loading | empty | error | populated`. No Phase 1 work unless the audit reveals state copy/aesthetics drift from the design (e.g., the design's "retention edge" striped state isn't supported — defer to Phase 2 if it surfaces).

#### O4 Live tail

Existing: `LogsTab.tsx` is comprehensive — URL state, live tail + range mode auto-switch, filter pills, inspector. No Phase 1 work beyond adding `<StatusPill />` to the toolbar.

#### O7 Disabled state

Existing: `DisabledState.tsx` exists and is wired into `LogsTab` via `useObservabilityFlag`. Verify it's wired into `MetricsTab` too (audit didn't confirm); add if missing.

#### DLQ peek panel (new)

`src/modules/observability/DLQPeekPanel.tsx`:
- Reuses the data fetch shape from `DLQViewer` (fetch `/ui-api/pipeline/[id]/dlq/state`)
- Renders: header (`47 msgs · 1h · 12 unconsumed`), 4 most-recent entries from a LogsQL probe (`service.namespace:pipeline-<id> AND _stream:dlq | last 4`), 3 action buttons
- Buttons: "Open DLQ viewer" (`<Link>` to standalone), "Consume…" + "Purge…" (open the same `FlushDLQModal` that `DLQViewer` uses, or share state via a small shared hook)

#### Status pill (new)

`src/modules/observability/StatusPill.tsx`:
- Reads from `/ui-api/observability/stack` (extend the existing route if it doesn't already return disk + retention)
- Renders `internal stack · {discUsed} · {retention}` when internal stack is enabled
- Hidden when `NEXT_PUBLIC_INTERNAL_METRICS_ENABLED=false` (the parent tab renders `DisabledState` in that case)

#### Component filter on metrics (new)

`src/modules/observability/MetricsComponentFilter.tsx`:
- Wraps `FilterPillRow` for the metrics toolbar
- Selection persisted as `?comp=ingestor,processor` URL param
- Filter applied per-chart: `MetricsTab` passes the selected components down to `ChartCard`, which filters its series array before rendering

#### NOTE banner (new)

`src/modules/observability/ScopingNoteBanner.tsx`:
- Orange-tinted card explaining `pipeline_id` scoping enforcement
- Dismissible × button; persists dismissal to `localStorage` key `obs.scopingNoteDismissed.v1`
- Renders inside `MetricsTab` below the toolbar

### Phase 2 — post-M2

- **O5 Logs search + context expansion + range correlation** — substantial work in `LogsTab`: pinned-range chip integration into mini metrics strip (`MiniMetricsStrip` exists, needs wiring), context-expansion polish, "same shape" footer via `ContextClusterer.ts`
- **O6 Inspector drawer cross-cutting links** — extend `LogInspectorDrawer` with schema/trace/DLQ cross-links section

### Parallel deliverables

None for M2 — DLQ backend endpoints (`/dlq/state`, `/consume`, `/purge`) already exist per the audit of `DLQViewer.tsx`.

---

## 7. API surface

### Existing — keep as-is

| Route | Purpose |
|---|---|
| `/ui-api/pipelines/[id]/metrics` | Proxies PromQL to VM with `pipeline_id` enforcement |
| `/ui-api/pipelines/[id]/logs` | Proxies LogsQL to VL with `pipeline_id:` enforcement |
| `/ui-api/pipelines/[id]/logs/stream` | SSE live tail |
| `/ui-api/observability/stack` | Stack telemetry — feeds status pill |
| `/ui-api/pipeline/[id]/dlq/state` | DLQ count + size |
| `/ui-api/pipeline/[id]/dlq/consume` | Consume N events |
| `/ui-api/pipeline/[id]/dlq/purge` | Drop the queue |

### Possibly extended

- `/ui-api/observability/stack` — if status pill needs disk-used + retention fields and they're not already in the response, extend. Confirm during implementation by reading the route.

---

## 8. Testing strategy

Existing tests cover `CardinalityTable`, `DisabledState`, `FanOutDiagram`, `RetentionBar`. Phase 1 work adds tests for:

| Layer | Subject | How |
|---|---|---|
| Unit | `OBChartSVG` | Vitest + RTL — render with props, simulate `mousedown`/`mousemove`/`mouseup`, assert `onBrushChange` fires with correct ms values; assert keyboard arrow nudges work |
| Unit | `DLQPeekPanel` | Mock `/dlq/state` + LogsQL probe; assert counts and recent-entries render; assert action buttons open the right modal |
| Unit | `StatusPill` | Mock `/observability/stack`; assert it renders the formatted string + hides when stack disabled |
| Unit | `MetricsComponentFilter` | Toggle pills, assert URL `?comp=` mutation |
| Unit | `ScopingNoteBanner` | Render, dismiss, assert `localStorage` write; mount again, assert hidden |
| Unit | `AutoRefreshControl` | Select option, assert store mutation + `localStorage` persistence |
| Integration | Multi-series `ChartCard` upgrade | Mock metrics response with 3 components, assert 3 lines render with correct tokens |
| Integration | `DrillDownView` brush flow | Mock metrics response, render, simulate brush drag, assert `observabilityStore.pinBrushedRange` called; navigate to `LogsTab` and assert range mode kicked in |
| Smoke | Full flow | Vitest e2e (or manual if no Playwright): load `/pipelines/abc/metrics`, click into a chart, brush, navigate to logs, verify pinned-range pill |

Run tests: `pnpm test:run` (vitest run mode). Watch: `pnpm test`.

---

## 9. Risks and open questions

| Risk | Severity | Mitigation |
|---|---|---|
| Multi-series `ChartCard` upgrade may regress existing visual consistency | Low | The component-color tokens already exist; tests guard against series-pick regressions |
| `OBChartSVG` brush UX has many edge cases (drag while paused, drag across update, brush spanning data gaps) | Medium | TDD each interaction; cover with Vitest + RTL |
| Status pill data source — `/observability/stack` may not expose disk/retention yet | Medium | Verify during implementation; extend route if needed |
| Metrics dashboard `?comp=` filter may need to thread through `useMetricsQuery` to skip queries entirely vs. filter client-side | Low | Start client-side (filter rendered series); revisit if VM round-trips become wasteful |
| DLQ peek `_stream:dlq` LogsQL — exact stream name may differ in backend log emission | Low | Verify shape during implementation; backend authoritative |
| The DLQ peek's `FlushDLQModal` confirmation may need to be hoisted so peek and viewer share state (e.g., refetch after action) | Low | Co-locate via a small `useDLQActions(pipelineId)` hook returning state + handlers; both peek and viewer consume |

### Open questions

1. Should the dashboard be 2-up (design) or stay 3-up at the `lg:` breakpoint (current)? Defer to design instinct during implementation.
2. Should `autoRefresh` polling drive `useMetricsQuery` from inside the hook, or via a React-Query–style `refetchInterval`? Likely the hook can accept an interval prop; verify pattern.
3. Is the existing `DisabledState` wired into `MetricsTab` as well as `LogsTab`? Verify during implementation; add if missing.
4. The `ScopingNoteBanner` — is one-time-dismissed-forever the right UX, or should it re-appear after some period? Going with "until cleared from localStorage" for v1.

---

## 10. Out of scope

- O8 Settings → Observability page work (already shipped, untouched)
- Brush UX on the dashboard 6-up grid (already has Recharts `ReferenceArea` brush; polished `OBChartSVG` brush is for drill-down only)
- Authentication / multi-tenancy enforcement at the UI layer (per ETL-1074)
- Exposing VM/VL via Ingress for direct browser access
- Caching / rate-limiting between UI and VM/VL
- Long-term metric retention beyond M1's 7d / 3d
- Cluster-wide metrics aggregation
- O5 search-with-context UX deepening (Phase 2)
- O6 inspector drawer cross-cutting links (Phase 2)
- DLQ viewer page UI rebuild (already exists)
- Trace viewer UI (no current surface)

---

## 11. Implementation references

| Topic | File |
|---|---|
| Design mockup (8 artboards) | `docs/claude_design_handovers/glassflow-revamp-reimagined/project/Observability Design.html` |
| Existing observability module | `src/modules/observability/` |
| Existing Zustand slice | `src/store/observability.store.ts` |
| Existing API routes | `src/app/ui-api/{pipelines/[id]/{metrics,logs,logs/stream},pipeline/[id]/dlq/*,observability/stack}` |
| Token system rules | `CLAUDE.md` §1–§7 |
| Component architecture | `.cursor/architecture/COMPONENT_ARCHITECTURE.md` |
| Test runner | `pnpm test:run` (vitest) |

---

## 12. Estimated effort (Phase 1) — post-audit

| Workstream | Days |
|---|---|
| `OBChartSVG` primitive (lines, axes, area, crosshair, brush, drag handles, keyboard) | 5 |
| `DrillDownView` upgrade (wire `OBChartSVG`, correlation panels, "Copy LogsQL") | 3 |
| Multi-series upgrade to `ChartCard` + threading component filter | 2 |
| `MetricsComponentFilter` + URL param threading + per-chart filtering | 1 |
| `StatusPill` (component + stack-route extension if needed) | 1 |
| `ScopingNoteBanner` (component + localStorage dismissal) | 0.5 |
| `AutoRefreshControl` (replace Switch, store change to `autoRefreshIntervalMs`, hook integration) | 1 |
| `DLQPeekPanel` + shared `useDLQActions` hook | 2 |
| MetricsTab layout restructure (grid + slot DLQ peek + verify DisabledState wired) | 1 |
| Testing (unit + integration + smoke) | 3 |
| **Subtotal** | **19.5** |
| Buffer for review, polish, integration | ~3 |
| **Total** | **~22.5 working days** |

Fits the 22-working-day M2 window with no buffer; tight but workable. Audit shrunk the estimate substantially vs. the original (~28 days) because most "new" components turned out to already exist.

---

**End of design document.**
