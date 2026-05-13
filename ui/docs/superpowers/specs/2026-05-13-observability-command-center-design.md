# Observability Command Center — Design Spec

**Date:** 2026-05-13  
**Status:** Approved, ready for implementation planning  
**Author:** Vladimir Cutkovic

---

## 1. Context and motivation

The current "Observability" surface in the sidebar points to `/workspace/observability`, which renders only `StackAdminPanel` — a stack admin view showing VM/VL versions, retention, and cardinality. This audience (infrastructure admins) is not the primary user of observability in GlassFlow.

Separately, `/observability` exists as an orphaned pipeline health table (`ObservabilityLandingClient`) with a throughput column that always shows `—` because it never calls VM. It is not in the primary nav. The per-pipeline `/observability/[id]` route is a lighter duplicate of the pipeline detail page.

The result is three fragmented surfaces with no clear owner and no triage capability.

**This spec defines a replacement:** a single `ObservabilityCommandCenter` at `/observability` that serves as a fleet-level command center — the canonical place to triage and compare running pipelines. Per-pipeline detail (metrics, logs, DLQ) stays exclusively in the pipeline detail tabs at `/pipelines/[id]/`.

---

## 2. Mental model

> **Observability = the map. Pipeline detail = the place.**

| Surface | Purpose | Answers |
|---|---|---|
| `/observability` | Fleet command center | "What's broken right now? Which pipeline is underperforming?" |
| `/pipelines/[id]/metrics` | Per-pipeline metrics | "What exactly is happening in this pipeline?" |
| `/pipelines/[id]/logs` | Per-pipeline logs | "What do the logs say?" |
| `/pipelines/[id]/dlq` | DLQ management | "What's in the dead-letter queue?" |

The command center is a lens over pipeline-level data. It owns no data of its own — it queries and surfaces it.

---

## 3. Scope decisions

| # | Decision | Choice | Reasoning |
|---|---|---|---|
| 1 | Fleet header content | Stat cards only (no fleet chart) | Zero VM dependency for the header — fast, always available. Cards: Running / Needs Attention / Paused / DLQ Backlog. |
| 2 | Per-row data density | Sparkline-enhanced table | Throughput (ev/s) and error rate (%) sparklines per active pipeline row, pulled from VM. Shows trend anomalies without requiring a click-through. |
| 3 | Drill-down destination | `/pipelines/[id]/*` tabs | A pipeline has one canonical detail page. The command center deep-links into the relevant tab based on the signal clicked. No `/observability/[id]` equivalent is created. |
| 4 | `/workspace/observability` | Remove entirely | `StackAdminPanel` has unclear purpose and audience. Deleted. |
| 5 | `/observability/[id]` | Redirect then delete | Redirects to `/pipelines/[id]/overview`. Orphaned page — no clear owner. |
| 6 | Sidebar nav | "Observability" → `primaryNavItems`, href → `/observability` | Promoted from workspace section. It's a primary operational surface, not a settings area. |
| 7 | `observabilityStore` time range sync | Out of scope (Phase 2) | The time range selected on the command center does not yet write to `observabilityStore.rangeKey`. The per-pipeline metrics page opens at its own default. A one-day add-on once the command center time range picker exists. |

---

## 4. Component architecture

### New components

```
src/modules/observability/
  ObservabilityCommandCenter.tsx    ← top-level client component; owns all local state
  ObservabilityStatCards.tsx        ← 4 KPI cards from pipeline list API
  ObservabilityFleetTable.tsx       ← table shell; applies sort + filter; renders rows
  ObservabilityFleetRow.tsx         ← single row; calls useMetricsQuery for sparklines
```

### Replaced / removed

| File | Action |
|---|---|
| `ObservabilityLandingClient.tsx` | Deleted after cutover |
| `src/app/(shell)/observability/[id]/page.tsx` | Replaced with `redirect('/pipelines/[id]/overview')` then deleted |
| `src/app/(shell)/workspace/observability/page.tsx` | Deleted (or redirect to `/observability`) |

### Modified

| File | Change |
|---|---|
| `src/app/(shell)/observability/page.tsx` | Swap import: `ObservabilityLandingClient` → `ObservabilityCommandCenter` |
| `src/components/shared/AppSidebar.tsx` | Move "Observability" from `workspaceNavItems` to `primaryNavItems`; update `href` from `/workspace/observability` to `/observability`; update `matchPaths` |

### Untouched

All per-pipeline observability: `MetricsTab`, `LogsTab`, `DrillDownView`, `OBChartSVG`, `BrushedRangePill`, `DLQViewer`, `useMetricsQuery`, `useLogsQuery`, `useLogStream`, `observability.store.ts`, all API routes.

---

## 5. State model

All state is local to `ObservabilityCommandCenter` — no Zustand, no URL params for Phase 1.

```ts
type TimeRange = '15m' | '1h' | '6h' | '24h'
type StatusFilter = 'all' | 'active' | 'degraded' | 'paused'
type SortBy = 'name' | 'throughput' | 'errors' | 'dlq'
type SortDir = 'asc' | 'desc'

// Local state in ObservabilityCommandCenter
timeRange: TimeRange           // default: '1h'
statusFilter: StatusFilter     // default: 'all'
sortBy: SortBy                 // default: 'errors' (surfaces degraded pipelines first)
sortDir: SortDir               // default: 'desc'
autoRefreshInterval: 30 | 60 | null  // default: 30 (seconds)
```

`timeRange` is passed down to every `ObservabilityFleetRow` so all sparklines always cover the same window.

---

## 6. Data fetching

### Pipeline list (fast path)

`ObservabilityCommandCenter` calls `getPipelines()` on mount (existing API call, no new route needed). Returns: `pipeline_id`, `name`, `status`, `health_status`, `transformation_type`, `dlq_stats.unconsumed_messages`. This feeds the stat cards and the skeleton of every table row immediately.

### VM sparklines (async per row)

`ObservabilityFleetRow` calls `useMetricsQuery(pipelineId, { rangeKey: timeRange })` — the existing hook, reused as-is. This returns `throughputSeries` and `errorRateSeries`.

**Query guard:** the VM call is skipped entirely when `pipeline.status === 'paused'`. Paused rows render `—` in the sparkline cells without making a network request.

**Query count:** with N active pipelines, the command center makes N `useMetricsQuery` calls. Each is a lightweight PromQL request. For installations with >30 active pipelines, a future optimisation is to batch into a single regex query — out of scope for Phase 1.

### Sort on async data

Sorting by `throughput` or `errors` is applied reactively as VM data arrives. The sort key is the latest data point in the series (the most recent value). Rows without VM data yet are sorted to the bottom of the sort direction. Sort state is reset when `timeRange` changes.

---

## 7. UI surface — section by section

### Header

```
title: "Observability"
subtitle: "Fleet health and triage across all running pipelines"
```

### Stat cards (4 cards, 2×2 on mobile, 4-up on desktop)

| Card | Value source | Colour |
|---|---|---|
| Running | `pipelines.filter(p => p.status === 'active').length` | `--color-foreground-positive` |
| Needs Attention | `pipelines.filter(isDegraded).length` | `--color-foreground-critical` when > 0, else `--text-secondary` |
| Paused | `pipelines.filter(p => p.status === 'paused' \|\| p.status === 'pausing').length` | `--text-secondary` |
| DLQ Backlog | `pipelines.reduce((n, p) => n + (p.dlq_stats?.unconsumed_messages ?? 0), 0)` | `--color-foreground-critical` when > 0, else `--text-secondary` |

### Toolbar (below stat cards, above table)

Left side: status filter pills — `All (N)` / `Active` / `Degraded` / `Paused`. Active pill uses primary colour; inactive use `--surface-border` ring.

Right side: time range segment control (`15m · 1h · 6h · 24h`, default `1h`) + auto-refresh control (`↻ 30s`, also available: `60s`, `off`).

### Table columns

| Column | Sortable | Content |
|---|---|---|
| Pipeline | Yes (by name) | Name (link → `/pipelines/[id]/metrics`) + sub-text: environment + topic count |
| Status | No | `StatusBadge` component |
| Throughput | Yes | `Sparkline` (80px wide, current range) + latest ev/s value. Link → `/pipelines/[id]/metrics`. `—` when paused. |
| Errors | Yes | `Sparkline` (60px wide) + latest error rate %. Link → `/pipelines/[id]/logs` when errors > 0, else `/pipelines/[id]/metrics`. `—` when paused. |
| DLQ | Yes | Count. Link → `/pipelines/[id]/dlq` when > 0. Text colour `--color-foreground-critical` when > 0. |
| (chevron) | No | `›` — always links to `/pipelines/[id]/metrics` |

**Row states:**
- `degraded` — subtle red background tint (`--color-background-critical-faded`)
- `paused` — reduced opacity (0.55), sparkline cells show `—`
- `active` — default table row background (`--table-row-bg`)

Degraded rows are sorted to the top by default (sort: `errors desc`).

### Context-sensitive deep-link logic

```ts
function getPipelineLink(pipeline, clickTarget: 'name' | 'throughput' | 'errors' | 'dlq' | 'row'): string {
  const base = `/pipelines/${pipeline.pipeline_id}`
  if (clickTarget === 'dlq' && dlqCount > 0) return `${base}/dlq`
  if (clickTarget === 'errors' && errorRate > 0) return `${base}/logs`
  return `${base}/metrics`
}
```

### Empty state

Reuses the existing `EmptyState` pattern from `ObservabilityLandingClient` — icon + "No pipelines yet" + link to `/home`.

### VM-disabled state

When `NEXT_PUBLIC_INTERNAL_METRICS_ENABLED=false` the sparkline columns are hidden and replaced with a single "Metrics unavailable" note cell. Stat cards and table status/DLQ columns still render.

---

## 8. Testing strategy

| Layer | Subject | How |
|---|---|---|
| Unit | `ObservabilityStatCards` | Mock pipeline list; assert counts and colours |
| Unit | `ObservabilityFleetTable` sort | Pass rows with known values; assert sort output by column + direction |
| Unit | `ObservabilityFleetTable` filter | Assert filtered rows match selected status |
| Unit | Context-link logic | Assert correct `/metrics`, `/logs`, `/dlq` hrefs per signal and value |
| Unit | `ObservabilityFleetRow` VM guard | Assert `useMetricsQuery` not called for paused pipelines; assert `—` renders |
| Integration | Full render | Mock `getPipelines()` + `useMetricsQuery`; assert sparklines render; assert degraded rows have red tint |
| Integration | Auto-refresh | Advance timers; assert `getPipelines()` called at configured interval |

---

## 9. Risks and open questions

| Risk | Severity | Mitigation |
|---|---|---|
| N VM queries for N active pipelines — performance at scale | Low for Phase 1 (most installs have <20 pipelines) | Batch regex query optimisation in Phase 2 if needed |
| Sort on async sparkline data causes layout shift | Low | Rows render in list-API order on first paint; sort applies only after VM data settles. Use a stable sort key. |
| `StackAdminPanel` removal — is it referenced anywhere else? | Low | Grep before deleting: `grep -r "StackAdminPanel"` — only used in `/workspace/observability/page.tsx` |
| `/observability/[id]` may be linked from emails or external tools | Low | Redirect is permanent (308), not a delete. Fine. |

**Open question:** Should the "Observability" nav item be in `primaryNavItems` (alongside Dashboard, Pipelines, Library) or stay in `workspaceNavItems` with the updated href? The user said it's a "top-level module" — move to primary.

---

## 10. Out of scope

- `observabilityStore.rangeKey` sync from the command center time range (Phase 2 — one-day add-on)
- Batch VM query optimisation for large fleets (Phase 2)
- `StackAdminPanel` / VM/VL admin surface — removed, no replacement planned
- Cross-pipeline aggregated fleet chart in the header (explicitly declined)
- URL param persistence for filter/sort/time range (Phase 2 if requested)
- Notification channel config (was in `/observability/[id]`, drops out of scope)

---

## 11. Implementation references

| Topic | File |
|---|---|
| Existing landing client (to replace) | `src/modules/observability/ObservabilityLandingClient.tsx` |
| Existing metrics hook | `src/hooks/useMetricsQuery.ts` |
| Existing Zustand slice | `src/store/observability.store.ts` |
| Pipeline list API | `src/api/pipeline-api.ts` → `getPipelines()` |
| Sidebar nav | `src/components/shared/AppSidebar.tsx` |
| Token system | `CLAUDE.md` §1–§7 |
| Test runner | `pnpm test:run` (vitest) |

---

## 12. Estimated effort

| Workstream | Days |
|---|---|
| `ObservabilityStatCards` (extracted, tested) | 0.5 |
| `ObservabilityFleetRow` (sparklines via `useMetricsQuery`, VM guard, context links) | 2 |
| `ObservabilityFleetTable` (sort, filter, empty state, VM-disabled state) | 2 |
| `ObservabilityCommandCenter` (toolbar, time range, auto-refresh, composition) | 1.5 |
| Route cleanup (redirects, page.tsx swaps, sidebar update) | 0.5 |
| Delete orphaned files (`ObservabilityLandingClient`, `/workspace/observability`, `/observability/[id]`) | 0.5 |
| Tests | 1.5 |
| **Total** | **~8.5 working days** |

---

**End of design document.**
