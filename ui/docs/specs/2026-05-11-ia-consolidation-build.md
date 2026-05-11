---
type: build-checklist
product: GlassFlow ClickHouse ETL
feature: IA Consolidation
tier: pro
status: ready-to-build
created: 2026-05-11
updated: 2026-05-11
skill: product:build
related:
  pitch: docs/specs/2026-05-11-ia-consolidation-pitch.md
---

# Build Checklist: IA Consolidation

## Product Readiness

| Check | Result |
|-------|--------|
| Shaped pitch exists with done criteria and no-gos | ✓ |
| Every screen in scope has a screen spec | ✗ — no `docs/screens/` directory exists; inline specs below substitute |
| Every screen spec has loading, empty, error states | ✗ — not formally specced; states documented per surface below |
| Domain-specific states are specced | ✓ — covered in journey maps |
| All copy uses glossary terms | ✓ — verified against `docs/product/glossary.md` |
| Destructive actions have confirmation patterns | ✓ — DLQ discard requires confirmation per journey spec |

**Screen spec gap:** No `docs/screens/` directory. This is a governance gap identified in the audit — it is **not** a blocker for this pitch since the journeys and IA documents serve as the specification layer. The three surfaces that need new/changed behaviour are documented inline below.

---

## Domain Model Readiness

| Check | Result |
|-------|--------|
| Core objects exist in codebase (types, interfaces, models) | ✓ |
| Object states mapped — no raw backend states in UI | ✓ — `PipelineStatus` enum exists and is mapped |
| Object relationships reflected in data layer | ✓ — Drizzle schema + Go backend API proxy cover all objects in scope |

**Verified objects this feature touches:** Pipeline, Connection (Kafka + ClickHouse), PipelineHealth, Draft.

---

## Build Checklist — Per Criterion

### Criterion 1 — Create modal is the sole entry to all creation lanes

**Done means:** clicking Create anywhere opens a modal with Wizard / Canvas / AI options; no redirect to `/home`.

**Current state (codebase verified):**

`src/components/common/CreatePipelineModal.tsx` exists and is already wired to ShellLayoutClient. It has three wrong hrefs:

```tsx
// CURRENT — wrong
const lanes: LaneOption[] = [
  { id: 'wizard', href: '/',                    ... },   // ← should be /pipelines/create
  { id: 'canvas', disabled: true, comingSoon: true },    // ← route IS built; needs enabling
  { id: 'ai',    href: '/pipelines/create/ai',  ... },   // ← dead route; needs AI drawer
]
```

**Fix required:**
- Wizard `href` → `/pipelines/create`
- Canvas: remove `disabled: true` and `comingSoon: true`; set `href: '/canvas'`
- AI lane: remove `href`; instead call `onClose()` and trigger Cmd+K drawer (pass `onOpenAiDrawer` callback from ShellLayoutClient)

**Verdict:** ✗ — 3 targeted edits needed; all unblocked.

---

### Criterion 2 — `/home` has zero nav links pointing to it; navigating there redirects to `/dashboard`

**Done means:** `/home` route redirects to `/dashboard`. No link in the UI points to `/home`.

**Current state (codebase verified):**

`/home` is a full page (`src/app/(shell)/home/page.tsx`) rendering `HomePageClient`. It is **not** a redirect. References to `/home` found in:

| File | Reference type |
|------|---------------|
| `src/components/home/HomePageClient.tsx` | `router.push('/home')` after wizard redirect logic |
| `src/components/pipelines/PipelinesEmptyState.tsx` | `href="/home"` CTA |
| `src/components/pipelines/NoPipelines.tsx` | `href="/home"` CTA |
| `src/components/dashboard/DashFirstRun.tsx` | `href="/home"` CTA |
| `src/app/(shell)/pipelines/create/page.tsx` | `router.push('/')` fallback (routes to home) |

**Fix required:**
- `src/app/(shell)/home/page.tsx` → replace page content with `redirect('/dashboard')`
- Update each `/home` link in the 5 files above to trigger the Create modal instead (or link to `/dashboard` where a modal trigger is not appropriate)
- The `PipelinesEmptyState`, `NoPipelines`, and `DashFirstRun` CTAs should use the ShellLayoutClient `onCreateClick` pattern (prop drill or context) rather than hard-coded hrefs

**Verdict:** ✗ — straightforward but touches 6 files; all unblocked.

---

### Criterion 3 — `/pipelines/create/ai` removed (redirects to `/pipelines/create`)

**Done means:** navigating to `/pipelines/create/ai` redirects to `/pipelines/create`.

**Current state (codebase verified):**

`src/app/(shell)/pipelines/create/ai/page.tsx` currently does:
```tsx
redirect('/?openAi=1')  // dead — openAi query param no longer works
```

**Fix required:**
- Replace `redirect('/?openAi=1')` with `redirect('/pipelines/create')`
- One line change.

**Verdict:** ✗ — 1 line; unblocked.

---

### Criterion 4 — Library Connections work end-to-end (Kafka + ClickHouse)

**Done means:** user can save a Kafka connection, find it in Library, and select it from the wizard Kafka connection step and canvas KafkaSource node drawer.

**Current state (codebase verified):**

The Library Connection API routes are **fully built**:
- `src/app/ui-api/library/connections/kafka/` — full CRUD (GET list, GET by id, POST, PUT, DELETE)
- `src/app/ui-api/library/connections/clickhouse/` — full CRUD (GET list, GET by id, POST, PUT, DELETE)

The Library UI is built and wired to these routes. Test button and inline edit are flagged as needing work in the IA screen inventory.

**Gaps:**
- Wizard Kafka connection step does not surface "Use saved connection" option from Library
- Canvas KafkaSource/ClickHouseSink node drawers do not surface "Pick from Library" option
- No "Save to Library?" nudge after a successful connection test in wizard or canvas

**Fix required:** A shared `LibraryConnectionPicker` component — one component reused in 3 places:
1. Wizard Step 2 (Kafka connection form): "Use saved" dropdown above manual fields
2. Wizard Step 9 (ClickHouse connection form): same
3. Canvas node drawer (KafkaSource + ClickHouseSink): same picker in drawer header

**Verdict:** ✗ — new component + 3 integration points; unblocked. See architecture section.

---

### Criterion 5 — Library Schema, Dedup, Filter tabs show "coming soon" state

**Done means:** no mock data visible as if it were real on these tabs.

**Current state (codebase verified):**

Library dedup and filter pages check `NEXT_PUBLIC_USE_MOCK_API`. When `true`, they render populated mock content that looks like real saved configs. The Schema tab similarly has no real routes — it shows either mock data or an empty state depending on the flag.

**Fix required:**
- Remove `NEXT_PUBLIC_USE_MOCK_API` branch from dedup, filter, and schema tab pages
- Replace with a `ComingSoon` component (reuse the existing coming-soon pattern if one exists in `src/components/ui/`)
- "Coming soon" state should include: tab label, brief description of what this will do, and no fake data

**Verdict:** ✗ — 3 tab pages; unblocked.

---

### Criterion 6 — Per-pipeline metrics scoped to the pipeline with time-range selector

**Done means:** `/pipelines/[id]/metrics` shows data for that pipeline only, with 1h / 6h / 24h time range options.

**Current state (codebase verified):**

VictoriaMetrics is proxied via `/ui-api/pipelines/[id]/metrics`. However, the queries are currently aggregated across all pipelines — no `pipeline_id` label filter is applied. The time-range selector does not exist.

**Blocker:** Backend team must confirm VictoriaMetrics query contract for per-pipeline `pipeline_id` label filtering before UI can implement scoped time-series charts.

**Unblocked partial work:** Add the time-range selector component (`TimeRangeSelector`: `1h | 6h | 24h` toggle) to the metrics page — this can be built and wired to query params without the per-pipeline contract, since the chart data source is swapped in when the API contract lands.

**Verdict:** ✗ BLOCKED for scoping; ✓ time-range selector unblocked.

---

### Criterion 7 (from pitch inclusions) — Observability landing page is real

**Done means:** `/observability` shows pipeline counts by status, aggregate DLQ total, aggregate throughput.

**Current state:**

`src/app/(shell)/observability/page.tsx` is a "Coming soon" stub.

**Blocker:** A cross-pipeline stats endpoint does not currently exist. The fallback strategy (client-side aggregation from the pipeline list endpoint) is possible but needs confirmation that `/ui-api/pipeline` returns health fields (DLQ count, status, throughput) per pipeline in a single call.

**Unblocked partial work:** Build the Observability landing page layout using the pipeline list endpoint for client-side aggregation. Swap to a dedicated stats endpoint when available.

**Verdict:** ✗ SOFT BLOCKED — can start with client-side aggregation fallback.

---

## Architecture

### Files to modify

| File | Change | Blocked? |
|------|--------|----------|
| `src/components/common/CreatePipelineModal.tsx` | Fix 3 lane hrefs; wire AI lane to drawer callback | No |
| `src/components/shared/ShellLayoutClient.tsx` | Pass `onOpenAiDrawer` callback to both AppTopbar and CreatePipelineModal | No |
| `src/components/shared/AppTopbar.tsx` | Fix Observability nav link (`/workspace/observability` → `/observability`) | No |
| `src/app/(shell)/home/page.tsx` | Replace page content with `redirect('/dashboard')` | No |
| `src/app/(shell)/pipelines/create/ai/page.tsx` | Replace `redirect('/?openAi=1')` with `redirect('/pipelines/create')` | No |
| `src/components/home/HomePageClient.tsx` | Remove `/home` router.push; trigger Create modal | No |
| `src/components/pipelines/PipelinesEmptyState.tsx` | Replace `href="/home"` with Create modal trigger | No |
| `src/components/pipelines/NoPipelines.tsx` | Replace `href="/home"` with Create modal trigger | No |
| `src/components/dashboard/DashFirstRun.tsx` | Replace `href="/home"` with Create modal trigger | No |
| `src/app/(shell)/library/[tab]/page.tsx` (dedup, filter, schema) | Replace mock branch with ComingSoon component | No |
| `src/app/(shell)/observability/page.tsx` | Build real landing page (client-side aggregation fallback) | Soft |
| `src/app/(shell)/pipelines/[id]/metrics/page.tsx` | Add TimeRangeSelector; add pipeline_id filter when API contract confirmed | Partial |
| Wizard Kafka connection step | Add LibraryConnectionPicker above manual fields | No |
| Wizard ClickHouse connection step | Add LibraryConnectionPicker above manual fields | No |
| Canvas KafkaSource node drawer | Add LibraryConnectionPicker in drawer | No |
| Canvas ClickHouseSink node drawer | Add LibraryConnectionPicker in drawer | No |

### New files to create

```
src/components/common/LibraryConnectionPicker.tsx
  — "Use saved" dropdown component
  — props: type: 'kafka' | 'clickhouse', onSelect: (connection: SavedConnection) => void
  — fetches from /ui-api/library/connections/[type]
  — renders as collapsible "Use a saved connection" section above manual form fields
  — shows inline "Save this connection" nudge after successful test

src/components/common/ComingSoon.tsx  (if not already exists)
  — reusable "coming soon" placeholder state
  — props: featureName: string, description?: string

src/components/common/TimeRangeSelector.tsx
  — toggle: 1h | 6h | 24h
  — controlled via URL query param ?range=1h
  — used in /pipelines/[id]/metrics

src/app/(shell)/observability/page.tsx  (replacement)
  — loads pipeline list via /ui-api/pipeline
  — aggregates client-side: count by status, sum DLQ, sum throughput
  — renders health overview cards + pipeline status table
  — links each row to /observability/[id]
```

### Components to reuse

- `src/components/ui/badge.tsx` — pipeline status badges in Observability landing
- `src/components/ui/card.tsx` — health summary cards
- Existing `ConnectionForm` in wizard — wrap, don't replace; LibraryConnectionPicker sits above it
- `src/components/pipelines/PipelineStatusBadge.tsx` (if exists) — in Observability table

---

## Instrumentation Plan

| Event | When it fires | Properties |
|-------|--------------|------------|
| `create_modal_opened` | Create modal opens | `source: 'sidebar' \| 'dashboard_cta' \| 'empty_state'` |
| `create_lane_selected` | User picks Wizard / Canvas / AI | `lane: 'wizard' \| 'canvas' \| 'ai'` |
| `library_connection_picker_opened` | User expands "Use saved connection" | `step: 'kafka' \| 'clickhouse', surface: 'wizard' \| 'canvas'` |
| `library_connection_selected` | User picks a saved connection | `connection_type: 'kafka' \| 'clickhouse', source: 'library'` |
| `save_to_library_nudge_accepted` | User saves connection after test | `connection_type: 'kafka' \| 'clickhouse'` |
| `save_to_library_nudge_dismissed` | User dismisses the save nudge | `connection_type: 'kafka' \| 'clickhouse'` |
| `observability_landed` | User arrives at /observability | `pipeline_count: number, degraded_count: number` |
| `observability_pipeline_selected` | User clicks into a pipeline from health overview | `pipeline_id: string, status: string` |
| `metrics_time_range_changed` | User changes time range | `range: '1h' \| '6h' \| '24h', pipeline_id: string` |

---

## Acceptance Criteria (from pitch)

- [ ] A user who navigates to `/observability` sees a real cross-pipeline health overview — pipeline counts by status, aggregate DLQ total, aggregate throughput. Not a "Coming soon" placeholder.
- [ ] A user who clicks **Create** anywhere in the product sees a modal presenting Wizard / Canvas / AI options. There is no redirect to `/home`.
- [ ] `/home` has zero nav links pointing to it. Navigating to `/home` redirects to `/dashboard`.
- [ ] Library Connections work end-to-end: a user can save a Kafka connection, find it in the Library, and select it from the wizard's Kafka connection step and from a canvas KafkaSource node drawer.
- [ ] Library Schema, Dedup, and Filter tabs display a "coming soon" state — no mock data is visible as if it were real.
- [ ] Per-pipeline metrics on `/pipelines/[id]/metrics` show data scoped to that pipeline only, with a working time-range selector (minimum: 1h / 6h / 24h options).

---

## Gap Summary

### Hard blockers (cannot build without external input)

| Blocker | Owner | Unblocked fallback? |
|---------|-------|---------------------|
| Per-pipeline VictoriaMetrics query contract (`pipeline_id` label filtering) | Backend team | Time-range selector can be built now; scoped data waits for contract |

### Soft blockers (can proceed with fallback)

| Item | Fallback |
|------|----------|
| Cross-pipeline health stats endpoint for Observability landing | Client-side aggregation from `/ui-api/pipeline` list — confirmed possible |

### No blockers — start immediately

All remaining items in the pitch are purely front-end work against existing APIs:

1. Fix `CreatePipelineModal` lane hrefs (3 edits, 1 new callback)
2. Fix AppTopbar Observability link (1 edit)
3. Redirect `/home` page (1 edit + 5 component updates)
4. Redirect `/pipelines/create/ai` (1 line)
5. Mark Library schema/dedup/filter tabs as "coming soon" (3 pages)
6. `LibraryConnectionPicker` component + wizard/canvas wiring (1 new component, 4 integration points)
7. `TimeRangeSelector` component on metrics page (1 new component, 1 integration point)
8. Build Observability landing with client-side aggregation fallback (1 new page)

**Estimated unblocked surface:** ~85% of the pitch. The remaining 15% (per-pipeline metric scoping) is unblocked in the UI once the backend contract is confirmed.

---

## Recommended Build Order

Work in this sequence to deliver visible value and avoid rework:

**Day 1–2 — Nav and routing fixes** (purely structural, low risk)
1. Fix CreatePipelineModal hrefs + AI drawer callback
2. Fix AppTopbar Observability link
3. Redirect /home → /dashboard (page + all 5 component link updates)
4. Redirect /pipelines/create/ai → /pipelines/create
5. Mark Library schema/dedup/filter tabs as "coming soon"

**Day 3–4 — Observability landing page**
6. Build Observability landing with client-side aggregation
7. Wire status badges, DLQ totals, throughput from pipeline list

**Day 5–7 — Library connection picker**
8. `LibraryConnectionPicker` component
9. Wizard Kafka + ClickHouse steps integration
10. Canvas KafkaSource + ClickHouseSink drawer integration
11. Save-to-Library nudge

**Day 8 — Metrics time-range selector**
12. `TimeRangeSelector` component wired to metrics page
13. Stub pipeline_id filter — document that scoped data awaits backend API contract

**Day 9–10 — QA pass + backend API contract**
14. End-to-end smoke test all done criteria
15. If backend contract confirmed: implement per-pipeline query filter on metrics endpoint

---

*Updated 2026-05-11 via product:build*
