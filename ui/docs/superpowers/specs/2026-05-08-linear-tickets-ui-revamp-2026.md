# Linear Ticket Breakdown — UI Revamp 2026 (ETL-1071)

**Parent:** [ETL-1071 · UI 2.0](https://linear.app/glassflow/issue/ETL-1071/ui-20)
**Date:** 2026-05-08
**Branch:** `ui-ux-revamp-2.0`

12 sub-issues scoped at phase level. Each ticket covers a self-contained product surface. 9 are complete; 3 are remaining.

---

## Ticket 1 — App Shell & Navigation

**Status:** Done

**What this covers:**
New top-level navigation, full-width shell layout, CSS design token foundation, and shared UI primitives.

**Deliverables:**
- Replaced the old sidebar with a new AppSidebar covering: Dashboard, Pipelines, Library, Observability, and a global Create entry point
- Full-width shell: `--shell-max-width` token applied to topbar and shell content; per-component `max-width` removed from all modules
- CSS token alignment: `src/themes/base.css` and `src/themes/theme.css` updated with new semantic tokens for surfaces, borders, overlays, controls
- Typography utilities (`src/app/styles/typography.css`): `title-1`→`title-6`, `body-1`→`body-3`, `caption-1`→`caption-2`, `featured-1`→`featured-3`
- Animation utilities (`src/app/styles/animations.css`): `animate-fadeIn`, `animate-slideDown`, `smooth-expand`
- New UI primitives: `Drawer`, `Pill`, `EmptyState`, `Skeleton`, `KbdHint`, `Crumbs`, `Sparkline`, `ScopeBadge`, `LiveIndicator`, `TimeRangePicker`
- Mono font discipline: JetBrains Mono applied to IDs, timestamps, code, axis labels

**Technical notes:**
- Shell layout is in `src/app/(shell)/layout.tsx` + `src/components/shared/`
- All token changes follow the `CLAUDE.md` contract — no hardcoded hex/rgba anywhere
- Dark-only; no light-mode branches

---

## Ticket 2 — Dashboard

**Status:** Done

**What this covers:**
A purpose-built Dashboard that replaces the old home page redirect. Four distinct states based on fleet health: first-run onboarding, healthy with no attention needed, populated with active pipelines, and incident/attention-required.

**Deliverables:**
- 4-state orchestrator: `DashboardPage` computes state from pipeline + stats fetch, renders the correct layout
- **First-run state:** `DashFirstRun` — 6-path onboarding grid covering wizard, canvas, AI, library, observability, docs (2 paths feature-flagged/disabled)
- **Healthy/Populated state:** KPI cards, `ThroughputChart` (Recharts, 7d sparkline), `ActivityFeed`, `AttentionQueue` (severity-sorted alerts), `PipelineTable` with client-side filter chips
- **Incident state:** `AttentionQueue` elevated, scoped alerts with pipeline links
- `/` and `/home` redirect to `/dashboard`; `/home` wizard entry preserved as a direct path
- Server component fetches stats + pipeline list; passes computed state to `DashboardClient`
- Mock data layer for local development without a running cluster

**Technical notes:**
- `src/app/(shell)/dashboard/`
- Uses Recharts (locked in architectural decision D3)
- Pipeline table is separate from the Pipelines List module — dashboard-scoped, lighter weight

---

## Ticket 3 — Library — CRUD & Versioning

**Status:** Done

**What this covers:**
A reusable-component Library where teams store and manage Kafka connections, ClickHouse connections, schemas, deduplication configs, and filter configs — eliminating per-pipeline re-entry.

**Deliverables:**
- Drizzle ORM + Postgres `ui_library` schema: tables for `kafka_connections`, `clickhouse_connections`, `schemas`, `schema_versions`, `dedup_configs`, `filter_configs`, `transforms`, `transform_versions`, `folders`, `tags`
- Full CRUD API routes under `src/app/ui-api/library/`
- **Connections:** list + detail pages with 2fr/1fr kv-row layout, blast-radius dialog (shows how many pipelines reference a connection)
- **Schemas:** list with drift indicator + version badge + source filter chips; detail with fields table, version timeline, diff viewer, publish modal
- **Dedup configs:** list + detail pages
- **Filter configs:** list + detail pages
- `LibraryClient` — tabbed shell routing between Connections / Schemas / Dedup / Filters / (Transforms placeholder)
- Source filter chips, search, folder/tag organisation
- Library gap-closure polish pass: design consistency audit, token corrections, drift/version indicator improvements

**Technical notes:**
- `src/modules/library/` for components
- `src/lib/db/schema.ts` for Drizzle schema
- Mock seed data at `src/app/ui-api/library/__mock__/` for local dev
- Pinned-vs-live contract: connections are live (edits affect all pipelines immediately, with blast-radius warning); schemas are versioned and pinned per pipeline revision

---

## Ticket 4 — Pipelines List Redesign

**Status:** Done

**What this covers:**
A production-grade Pipelines list page replacing the previous minimal table — with bulk operations, persistent views, search, and density control.

**Deliverables:**
- `PipelinesTable`: enhanced columns — checkbox selection, status dot, type glyphs, DLQ color coding, pipeline name + sub-line (ID, type)
- `useBulkSelection` hook — multi-select with select-all, shift-click range
- `useListSearch` hook — debounced search over name/ID
- `useSavedViews` hook — named filter presets persisted in localStorage (Postgres-ready adapter interface)
- `PipelinesToolbar` — search input, filter chips (status, type), density toggle
- `SavedViewsStrip` — tab-row of saved view presets with create/delete
- `BulkActionBar` — contextual bar on selection: Stop, Resume, Terminate, Add Tag, Delete with confirmation
- `BulkTagModal` — tag-picker for bulk tagging
- `PipelinesEmptyState` — illustrated empty state with Create CTA and quick-start template cards
- `rowClassName` support on `PipelinesTable` for row-level highlight (selected, error, etc.)

**Technical notes:**
- `src/modules/pipelines/` for list components
- `src/app/(shell)/pipelines/page.tsx` wires everything together via `PipelinesPageClient`
- Density toggle (compact / default / comfortable) persisted in localStorage

---

## Ticket 5 — Pipeline Detail Tab Structure

**Status:** Done

**What this covers:**
Restructures the existing single-page pipeline detail into a tabbed nested route — a prerequisite for Canvas, Metrics, Logs, and Library Links living at distinct URLs.

**Deliverables:**
- `src/app/(shell)/pipelines/[id]/layout.tsx` — shared header + tab nav (Overview, Canvas, Metrics, Logs, Library Links, Settings)
- `src/app/(shell)/pipelines/[id]/page.tsx` — redirects to `/overview`
- `src/app/(shell)/pipelines/[id]/overview/page.tsx` — existing `PipelineDetailsModule` moved here, unchanged
- `src/app/(shell)/pipelines/[id]/canvas/page.tsx` — Canvas tab (Phase 6)
- `src/app/(shell)/pipelines/[id]/metrics/page.tsx` — Metrics tab (Phase 7)
- `src/app/(shell)/pipelines/[id]/logs/page.tsx` — Logs tab (Phase 8)
- `src/app/(shell)/pipelines/[id]/library-links/page.tsx` — Library Links tab (Phase 10)
- `src/app/(shell)/pipelines/[id]/settings/page.tsx` — Settings stub
- URL-addressable tabs: each tab SSR-cacheable and deep-linkable independently

**Technical notes:**
- Wizard-preservation contract: `PipelineDetailsModule` and all step renderers are untouched and still live under Overview
- Tabs read from / write to the same `coreStore` — switching tabs mid-edit preserves unsaved changes
- Architectural decision D1 in master plan

---

## Ticket 6 — Canvas Builder

**Status:** Done

**What this covers:**
A visual, graph-based pipeline builder as an alternative to the step-by-step wizard. Users assemble pipelines from Library components on a React Flow canvas.

**Deliverables:**
- `CanvasView` — React Flow canvas with medium-grain nodes: KafkaSource → Dedup? → Filter? → Transform? → ClickHouseSink; optional nodes greyed out until activated
- `NodePalette` / `PaletteItem` — drag-and-drop source for adding nodes
- `LibrarySidebar` / `LibraryResourceDrawer` — browse and attach Library components to nodes
- `LibraryChip` — inline chip on a node showing its Library-pinned resource
- `ValidationBadge` / `ValidationFooter` — per-node and footer-level validation state
- `DeployBar` / `CanvasDeployButton` — sticky footer bar triggering pipeline deploy from canvas state
- `DriftBanner` — banner shown when a pinned Library resource has a newer version
- `UpgradeModal` — upgrades a pinned resource to a new version
- `UnsavedChangesGuard` — blocks navigation when canvas has unsaved edits
- `NodeConfigPanel` — side panel for configuring a selected node (responsive: drawer below 1280px)
- `canvas-validation.ts` — validation logic; `serializer.ts` — canvas state ↔ pipeline config serialization
- Rejects type-incompatible edges at connection time

**Technical notes:**
- `src/modules/canvas/`
- `src/store/canvas.store.ts` — canvas Zustand slice
- Canvas produces the same pipeline config blob as the wizard (D6 invariant)
- Entry point: `/canvas` (global new pipeline) and `/pipelines/[id]/canvas` (edit existing)

---

## Ticket 7 — Observability — Metrics

**Status:** Done

**What this covers:**
Per-pipeline metrics monitoring tab powered by VictoriaMetrics, with auto-refresh, brushed time range, and drill-down.

**Deliverables:**
- `MetricsTab` — orchestrates hero cards + 6-chart grid + auto-refresh
- `HeroCard` — large KPI metric (throughput, lag, error rate, uptime)
- `ChartCard` / `ChartFrame` — Recharts chart wrapper with brush support
- `MetricsToolbar` — time range picker (preset + custom), auto-refresh toggle, `BrushedRangePill`
- `BrushedRangePill` — shows active brushed range; dismissable; propagates to Logs tab via observability store
- `DrillDownView` — component-level metric breakdown with jump-to-logs
- `FilterPillRow` — filter by pipeline component
- `CustomDateRangeModal` — custom date-range picker
- `MiniMetricsStrip` — compact sparklines for use outside the full tab (e.g. dashboard cards)
- Metrics proxy route: `src/app/ui-api/pipelines/[id]/metrics/route.ts` — rewrites PromQL to inject `{pipeline_id="<id>"}` server-side
- `observability.store.ts` Zustand slice — brushed range, time range, auto-refresh interval

**Technical notes:**
- Scope enforcement is server-side (D5 invariant) — UI cannot bypass it
- Uses Recharts with tree-shaking
- VictoriaMetrics compatible PromQL

---

## Ticket 8 — Observability — Logs

**Status:** Done

**What this covers:**
Per-pipeline log streaming and inspection tab powered by VictoriaLogs, with live-tail mode, search, severity filters, and contextual log expansion.

**Deliverables:**
- `LogsTab` — orchestrates toolbar + log line list + live tail + inline error banner
- `LogLine` — individual log row: timestamp, severity badge, component label, message, expand chevron
- `LogsToolbar` — search input, severity filter pills, component filter, live-tail toggle
- `LogInspectorDrawer` — full log entry detail in a side drawer
- `FilterPillRow` — active filter chips
- `ContextExpander` — clusters nearby log lines around a match; collapses gaps
- `ContextClusterer` — clustering algorithm for context expansion
- SSE stream proxy: `src/app/ui-api/pipelines/[id]/logs/stream/route.ts` — enforces `pipeline_id` scope, streams VictoriaLogs SSE
- LogsQL scope enforcer: server-side injection of `{pipeline_id="<id>"}` into every query
- URL-encoded state: query, severity filters, and component selection survive page refresh/share

**Technical notes:**
- Live tail uses SSE; regular fetch uses polling via `useDetailFetch` pattern
- Brushed range from Metrics tab propagates via `observability.store.ts` and is shown as a dismissable pill
- `src/modules/observability/`

---

## Ticket 9 — Observability — Admin

**Status:** Done

**What this covers:**
An admin panel for configuring and inspecting the observability stack (VictoriaMetrics + VictoriaLogs), accessible from the top-level Observability nav item.

**Deliverables:**
- `StackAdminPanel` — tabbed panel: Stack versions, Retention, Fan-out, Cardinality, Roadmap
- `RetentionBar` — visual retention period display + edit
- `FanOutDiagram` — SVG diagram of metrics fan-out paths
- `CardinalityTable` — table of high-cardinality label sets
- `M3M4M5Roadmap` — roadmap status component for observability milestone tracking
- `DisabledState` — shown when observability stack is not configured
- `NotificationChannelConfig` — configure alert notification channels (Slack, PagerDuty, webhook)
- Stack admin API route: `src/app/ui-api/observability/stack/route.ts`
- `src/app/(shell)/workspace/observability/page.tsx` — top-level Observability page

**Technical notes:**
- FanOutDiagram has N<2 guard (renders nothing if fewer than 2 fan-out targets)
- DisabledState is the default when no VictoriaMetrics/VictoriaLogs endpoints are configured

---

## Ticket 10 — Library–Pipeline Bridge

**Status:** Remaining

**What this covers:**
Connects the Library to deployed pipelines via a revision + reference system — so schema changes don't silently mutate running pipelines, and users can upgrade on their own schedule.

**Deliverables:**
- Drizzle migrations: `pipeline_revisions`, `pipeline_references`, `schema_versions` tables in `ui_library` schema
- Every pipeline deploy creates a new `pipeline_revision` (config snapshot) and `pipeline_references` rows (one per Library resource, with `pinnedVersion`)
- Connections are live (no pinning); schemas/transforms are pinned per revision
- **"Save to Library" prompts** at Kafka connection step and ClickHouse connection step in the wizard — non-blocking (user can skip)
- `BulkRolloutModal` — upgrade a schema version across multiple pipelines at once
- Library Links tab on pipeline detail (`/pipelines/[id]/library-links`) — lists all Library resources pinned to this pipeline's current revision, with drift indicators
- `DriftBanner` on Canvas (already built in Ticket 6) wired to revision data
- Revision history API: `src/app/ui-api/pipelines/[id]/revisions/route.ts`
- Library links API: `src/app/ui-api/pipelines/[id]/library-links/route.ts`

**Technical notes:**
- This is architectural decision D2 in the master plan
- Pinned-vs-live contract: connections show blast-radius warning on edit; schemas show drift indicator + upgrade CTA
- No Go backend changes required — the revision table lives in the UI-owned Postgres schema

---

## Ticket 11 — AI Assistant — Global Drawer

**Status:** Remaining

**What this covers:**
A conversational AI assistant mounted as a global portal overlay, reachable from anywhere in the app via ⌘K. Helps users describe a pipeline in natural language; generates a draft that opens in Canvas for visual confirmation before deploy.

**Deliverables:**
- `AiDrawer` — portal-mounted right-side overlay, not a route; persists across navigation
- Streaming chat UI with typing indicator and message history
- `ToolCallCard` — visual card shown when the AI calls a tool (e.g. "looked up Kafka topics", "generated pipeline config")
- Drawer scope header: shows current pipeline context or "New pipeline"
- Per-pipeline transcript persistence via `ai_chats` Drizzle table + `src/app/ui-api/ai/chats/[pipelineId]/route.ts`
- Global "new pipeline" scope: `aiUiStore.openDrawer({ kind: 'global' })`
- Pipeline-scoped chat: `aiUiStore.openDrawer({ kind: 'pipeline', pipelineId })`
- On completion: AI-generated draft opens in Canvas for visual review; no direct deploy from chat
- `ai-ui.store.ts` Zustand slice — drawer open/close, scope, streaming state
- ⌘K keybinding wired in root layout
- Feature-flagged: hidden when `ANTHROPIC_API_KEY` (or configured LLM key) is not set

**Technical notes:**
- Uses `createPortal` at root layout — not a Next.js route (architectural decision D4)
- Builds on existing `src/modules/ai/` LLM client, enrichers, and intent materialization from the `ai-assisted-journey` branch
- One chat per pipeline + one global chat (D4 invariant)
- Passwords/credentials are redacted before any LLM call

---

## Ticket 12 — Polish & Glue

**Status:** Remaining

**What this covers:**
Cross-cutting quality pass across all surfaces — empty/loading/error states, responsive layout, wizard acceptance criteria, notification wiring, and DLQ viewer integration.

**Deliverables:**
- Empty / loading (skeleton) / error state audit across all product surfaces: Dashboard, Library, Pipelines List, Canvas, Metrics, Logs
- Skeleton states occupy the same layout frame as populated content (no layout shift)
- Responsive audit: Canvas NodeConfigPanel already done (drawer below 1280px); remaining surfaces checked
- **Wizard acceptance criteria verification:**
  - `/pipelines/create` full step flow works end-to-end (Kafka → topic → dedup → ClickHouse → review → deploy)
  - Editing a deployed pipeline via Overview tab still uses wizard step renderers
  - Home page surfaces all three creation paths (Wizard / Canvas / AI)
  - No module under `src/modules/{kafka,clickhouse,deduplication,filter,join,otlp,resources,review,transformation}` was deleted
  - Switching between Overview and Canvas tabs on the same pipeline preserves unsaved edits
- `DLQViewer` wired into pipeline detail (component exists in observability module, needs route integration)
- `NotificationChannelConfig` wired into pipeline settings tab
- Cross-phase navigation consistency: breadcrumbs, back-links, deep-link sharing
- Final token audit: zero hardcoded hex/rgba remaining across all new files

**Technical notes:**
- This phase has no net-new product features — only quality, wiring, and invariant verification
- Run `pnpm sync-tokens` and `pnpm figma:publish` after token audit is complete
- Phase 8 in the master plan
