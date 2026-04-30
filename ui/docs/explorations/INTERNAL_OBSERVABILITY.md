Technical & Architectural Baseline: GlassFlow Observability UI

  What exists today

  Pipeline Details page (src/app/pipelines/[id]/page.tsx → PipelineDetailsModule.tsx)
  The main pipeline management surface. It has a sidebar-driven navigation with sections: monitor, resources, kafka/OTLP source, topic, transformation, deduplicate, join, clickhouse-connection, destination.

  The monitor section currently renders two static cards (PipelineStatusOverviewSection):
  - ClickHouseTableMetricsCard — polls ClickHouse system tables every 30 seconds, shows 8 snapshot metrics (row count, insert rate, latency P50/P95, table size, failed inserts, active queries, merges in progress). This is
  the buggy path — it reads from system.query_log scoped to table name, not pipeline_id, so pipelines sharing a destination table get conflated metrics.
  - DeadLetterQueueCard — DLQ state (total/unconsumed messages, timestamps, consume/purge actions).

  There are no charts, no time-series, no log viewer today.

  Routing:
  - / — home/pipeline creation
  - /pipelines/create — wizard
  - /pipelines/[id] — pipeline details (where the observability UI will live)

  In-progress work (unmerged, sprint-1 worktree):
  There is a (shell)/observability/ route with a placeholder hub page and an observability/[id] page (3-column layout: health card + DLQViewer + NotificationChannelConfig). This work is not merged into main. The new
  observability UI should supersede or absorb it.

  ---
  What needs to be built (UI scope — M3 + M4)

  M3 — Per-pipeline metrics dashboard
  Replace the static ClickHouseTableMetricsCard with time-series charts backed by VictoriaMetrics (via a new backend API). Charts needed:
  - Records ingested/sec
  - Records written/sec
  - Processing latency (P50/P95/P99)
  - DLQ rate
  - Bytes/sec

  Time-range selector: 15m / 1h / 6h / 24h / 7d. Component breakdown by role: ingestor / processor / sink.

  Empty state when internal observability is disabled (link to docs).

  M4 — Per-pipeline log viewer
  New surface (same page or tab) for structured log exploration:
  - Live-tail mode (SSE)
  - Component filter (ingestor / processor / sink / api / ui)
  - Severity filter (debug / info / warn / error)
  - Full-text search
  - Context expansion (N lines around a match)

  ---
  Integration points in the existing codebase

  ┌─────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────┐
  │                      What                       │                                Where                                 │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Pipeline details entry point                    │ src/app/pipelines/[id]/page.tsx                                      │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Main orchestrator component                     │ src/modules/pipelines/[id]/PipelineDetailsModule.tsx (479 lines)     │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Sidebar section definitions                     │ src/modules/pipelines/[id]/sidebar/sidebarItemBuilders.ts            │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Current metrics card (to replace)               │ src/modules/pipelines/[id]/ClickHouseTableMetricsCard.tsx            │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Current DLQ card                                │ src/modules/pipelines/[id]/DeadLetterQueueCard.tsx                   │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Current metrics API route (to deprecate)        │ src/app/ui-api/pipeline/[id]/clickhouse/metrics-from-config/route.ts │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ API routes live in                              │ src/app/ui-api/pipeline/[id]/                                        │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Zustand store (11 slices, no metrics slice yet) │ src/store/index.ts                                                   │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Pipeline health types                           │ src/api/pipeline-health.ts                                           │
  └─────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────┘

  New API routes needed (UI layer — thin proxies):
  - GET /ui-api/pipeline/[id]/metrics — proxy to backend VM API
  - GET /ui-api/pipeline/[id]/logs — proxy to backend VL API (SSE for live-tail)
  - GET /ui-api/observability/status — proxy to backend status endpoint

  These routes exist on the UI server only as pass-throughs. The actual query logic lives in the backend (see Part 2 below).

  New Zustand slice needed:
  observabilityStore — cache time-range selection, chart preferences, and observability feature-flag state (enabled/disabled). No metrics data itself should be stored in Zustand (it's too large and time-bounded — fetch
  directly).

  ---
  Design system constraints (non-negotiable)

  - No hardcoded colors — all via CSS variables (var(--color-*), var(--text-*), etc.)
  - Component variants only — <Button variant="primary">, <Card variant="dark">, <Badge variant="error">, never raw Tailwind color classes
  - Dark theme only — the app is dark-mode exclusively, no light-mode branches
  - Typography — title-1 through title-6, body-1 through body-3, caption-1/caption-2
  - Animations — use animate-fadeIn, animate-slideDown from animations.css, no one-off @keyframes
  - No chart library is installed yet — one needs to be chosen and added. Recharts is the natural fit (lightweight, composable, React-native). The design system tokens would need to be threaded into the chart color props.

  ---
  Part 2 — Backend API (not UI scope, backend team)

  These endpoints must exist before the UI charts and log viewer can be wired up. The UI will gracefully degrade (empty state) when they're absent.

  GET /api/v1/pipeline/{id}/metrics
    ?metric=records_ingested_per_sec|records_written_per_sec|latency|dlq_rate|bytes_per_sec
    &range=15m|1h|6h|24h|7d
    &step=auto
    → downsampled time-series array, enforced pipeline_id label filter against VictoriaMetrics

  GET /api/v1/pipeline/{id}/logs
    ?component=ingestor|processor|sink|api|ui
    &severity=debug|info|warn|error
    &q=<LogsQL free-text>
    &cursor=<opaque>
    → paginated log lines (and SSE stream variant for live-tail)

  GET /api/v1/observability/status
    → { enabled: bool, metricsRetentionDays: int, logsRetentionDays: int }

  Auth reuses existing API auth layer. Every query to VM/VL must inject pipeline_id label filter — the UI never passes it directly to VM/VL.

  ---
  Summary of what's missing to ship M3 + M4

  ┌─────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────┐
  │                             Gap                             │                        Impact                        │
  ├─────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ No chart library                                            │ Must add (recharts recommended)                      │
  ├─────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ No VM-backed metrics API routes (UI layer)                  │ ~3 thin proxy routes to add                          │
  ├─────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ No log SSE route (UI layer)                                 │ 1 new SSE route                                      │
  ├─────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ No observabilityStore Zustand slice                         │ Needed for time-range + feature-flag state           │
  ├─────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ ClickHouseTableMetricsCard stays until backend API is ready │ Runs parallel until M2 ships, then swap              │
  ├─────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ Backend API (M2)                                            │ Prerequisite for real data — blocked on backend team │
  └─────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┘

  
