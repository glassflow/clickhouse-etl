---
type: information-architecture
product: GlassFlow ClickHouse ETL
created: 2026-05-11
updated: 2026-05-11
skill: product:model
---

# Information Architecture — GlassFlow ClickHouse ETL

## Navigation Structure

```
[Sidebar — persistent]
  Logo → /dashboard
  [Create]                     ← primary action button → opens Create modal
  [AI Assistant]               ← Cmd+K global drawer (feature-flagged)
  ─────────────────
  Dashboard
  Pipelines
  Library
  Observability
  ─────────────────
  [Notifications badge]
  [User / Account]
  [Help]


Dashboard  /dashboard
  ├── System health summary (pipeline counts by status, DLQ totals, throughput)
  ├── Alert feed (pipelines in error, DLQ thresholds exceeded)
  ├── Pipeline quick list (recent / critical pipelines)
  └── First-run empty state (onboarding guide for new installations)

Pipelines  /pipelines
  ├── Pipeline list (filterable by status, environment label, source type)
  │     ├── Draft items (in-progress, unsaved deployments)
  │     └── [Create Pipeline] → Create modal
  └── Pipeline Detail  /pipelines/[id]
        ├── Overview          /pipelines/[id]/overview
        │     ├── Config summary (source, destination, processing steps)
        │     ├── Status + quick actions (pause / resume / stop / delete)
        │     └── Revision history timeline
        ├── Canvas            /pipelines/[id]/canvas
        │     └── Visual node editor (edit existing config before redeployment)
        ├── Metrics           /pipelines/[id]/metrics
        │     ├── Hero KPI cards
        │     ├── Time-series chart grid
        │     └── Drill-down  /pipelines/[id]/metrics/[query]
        ├── Logs              /pipelines/[id]/logs
        │     ├── LogsQL free-form query
        │     └── Live tail (SSE stream)
        ├── Library Links     /pipelines/[id]/library-links
        │     └── Pinned Library artifact versions + upgrade actions
        └── Settings          /pipelines/[id]/settings
              ├── Environment label
              ├── Notification channels (per-pipeline)
              └── Resource limits (CPU, memory)

Library  /library
  ├── Connections tab
  │     ├── Kafka connections list
  │     │     └── Connection detail  /library/connections/kafka/[id]
  │     └── ClickHouse connections list
  │           └── Connection detail  /library/connections/clickhouse/[id]
  ├── Schemas tab
  │     ├── Schema list
  │     └── Schema detail  /library/schemas/[id]
  │           ├── Field list + types
  │           ├── Version history
  │           └── Used by (Pipelines + bound artifacts)
  ├── Transforms tab
  │     ├── Transform list
  │     └── Transform detail  /library/transforms/[id]
  ├── Filters tab
  │     ├── Filter list
  │     └── Filter config detail  /library/filter/[id]
  └── Deduplication tab
        ├── Dedup config list
        └── Dedup config detail  /library/dedup/[id]

Observability  /observability
  ├── System health overview (cross-pipeline status summary)
  ├── Pipeline health detail  /observability/[id]
  │     ├── Health status card
  │     ├── DLQ viewer + consume action
  │     └── Notification channel config
  └── Stack Admin  /observability/stack  (formerly /workspace/observability)
        └── VictoriaMetrics/Logs stack versions, retention, fan-out config

[Create modal — not a route, triggered from sidebar]
  ├── Wizard      → /pipelines/create
  ├── Canvas      → /canvas  (new Draft)
  └── AI Assistant → AI drawer (Cmd+K) — shown only if AI is configured

[Global AI Drawer — Cmd+K, not a route]
  └── Chat interface + pipeline intent summary

[Notifications]  /notifications
  ├── Notification event list
  └── Global notification settings  /notifications/settings
```

---

## Screen Inventory

| Screen | Type | Area | Current route | Status |
|--------|------|------|---------------|--------|
| Dashboard | overview | Dashboard | `/dashboard` | exists — fix (wire real feeds) |
| First-run empty state | onboarding | Dashboard | `/dashboard` (state) | exists |
| Pipeline list | list | Pipelines | `/pipelines` | exists — fix (SSE, bulk actions) |
| Pipeline Overview | detail | Pipelines | `/pipelines/[id]/overview` | exists — fix (revision timeline) |
| Pipeline Canvas (edit) | builder | Pipelines | `/pipelines/[id]/canvas` | exists — fix (revision switching) |
| Pipeline Metrics | inspector | Pipelines | `/pipelines/[id]/metrics` | exists — keep |
| Metrics Drill-down | inspector | Pipelines | `/pipelines/[id]/metrics/[query]` | exists — keep |
| Pipeline Logs | inspector | Pipelines | `/pipelines/[id]/logs` | exists — keep (add export) |
| Library Links | detail | Pipelines | `/pipelines/[id]/library-links` | exists — fix (add upgrade action) |
| Pipeline Settings | settings | Pipelines | `/pipelines/[id]/settings` | **stub — build** |
| Wizard (creation) | builder | [Create modal] | `/pipelines/create` | exists — fix (guidance, draft save) |
| Canvas (creation) | builder | [Create modal] | `/canvas` | exists — fix (draft persistence) |
| AI Pipeline page | builder | [Create modal] | `/pipelines/create/ai` | **dead route — remove/redirect** |
| Library root | list | Library | `/library` | exists — fix (dedup/filter) |
| Connection detail | detail | Library | `/library/connections/[kind]/[id]` | exists — fix (test button, inline edit) |
| Schema detail | detail | Library | `/library/schemas/[id]` | exists — fix (version creation UI) |
| Transform detail | detail | Library | `/library/transforms/[id]` | exists — fix (validate/test, save UX) |
| Filter config detail | detail | Library | `/library/filter/[id]` | exists — **mark as coming soon or build** |
| Dedup config detail | detail | Library | `/library/dedup/[id]` | exists — **mark as coming soon or build** |
| Observability overview | overview | Observability | `/observability` | **stub — build** |
| Pipeline health detail | detail | Observability | `/observability/[id]` | exists (legacy route — keep, consider migration) |
| Stack Admin | settings | Observability | `/workspace/observability` → `/observability/stack` | exists — **relocate route** |
| Notification list | list | Notifications | `/notifications` | exists — review |
| Notification settings | settings | Notifications | `/notifications/settings` | exists — review |
| Home (legacy wizard entry) | list | — | `/home` | **retire** — replace with Dashboard |
| Welcome | onboarding | — | `/welcome` | **review** — may duplicate Dashboard empty state |
| Global log viewer | inspector | — | `/pipelines/logs` | **demote to dev/internal only** |
| Dev gallery | dev | — | `/dev/components` | keep as dev tool |
| Test health | dev | — | `/test-health`, `/test-pipeline-health` | keep as dev tools |

---

## Navigation Decisions

### 1. Dashboard is the single home base

**Decision:** `/dashboard` is the default landing page after login. `/home` is retired. The logo in the sidebar links to `/dashboard`.

**Rationale:** The product is a control plane. The control plane's entry point is a health overview, not a creation wizard. First-time users see the first-run empty state which guides them toward Library → Pipeline creation.

---

### 2. Canvas and AI are creation modes, not nav destinations

**Decision:** Canvas (`/canvas`) and AI-assisted creation are accessed only via the **Create modal** (triggered from the sidebar "Create" button). They do not appear as primary nav items.

**Rationale:** Adding Canvas and AI as separate top-level nav items creates 6 competing destinations (Dashboard, Pipelines, Library, Observability, Canvas, AI) — no clear center of gravity. Canvas and AI are *how* you create a Pipeline, not *where* you go to manage the product.

The global AI drawer (Cmd+K) remains available as a floating assistant across all surfaces but is not a nav section.

---

### 3. Workspace is retired; Stack Admin moves to Observability

**Decision:** `/workspace/observability` is relocated to `/observability/stack` (or a similar path under Observability). The "Workspace" nav label and concept are removed entirely.

**Rationale:** "Workspace" has no defined meaning in the product model. Stack admin (VictoriaMetrics/Logs config) is an operational concern — it belongs under Observability, not a vaguely-named section. Long term, a dedicated Settings/Admin section may be introduced when the product needs global config (user management, integrations, etc.).

---

### 4. Per-pipeline health detail lives under both Observability and Pipelines (deep-link)

**Decision:** `/observability/[id]` (legacy per-pipeline health) is retained as a dedicated Observability route. Pipeline metrics and logs remain under `/pipelines/[id]/metrics` and `/pipelines/[id]/logs`. Deep links between the two surfaces are supported.

**Rationale:** Two distinct user intents: "I want to debug this specific pipeline's health/DLQ/notifications" (Observability) vs. "I want to see metrics and logs for this pipeline while I'm in its detail view" (Pipelines). These are not the same mental model. Over time, the Observability section may absorb more of the per-pipeline detail, but the migration should be deliberate.

---

### 5. Environment is a filter on Pipelines list, not a nav concept

**Decision:** Environment labels (staging/production/dev) appear as filterable tags in the Pipeline list and as a label on Pipeline cards. There is no environment switcher in the nav or header.

**Rationale:** Environments are organizational labels, not structural namespaces. The user base does not require environment-level access control or config isolation today. A global environment switcher would imply a separation that doesn't exist at the infrastructure level, creating user confusion.

---

### 6. Draft persistence is required before the next major release

**Decision:** Both the Wizard and Canvas must persist in-progress configuration as a Draft. Drafts appear in the Pipelines list with a visual "Draft" badge. Users can resume or discard a Draft.

**Rationale:** Silent loss of work on navigate-away is the most user-hostile behavior in the current product. Pipeline configuration is complex (10+ steps); losing it midway through is a trust-destroying experience. Draft persistence is a foundational feature for the "smooth experience" success criterion.

---

### 7. Library dedup and filter tabs must be fixed before next public release

**Decision:** The Library's Deduplication and Filter tabs currently show mock-only data. These must either be built (real API routes + persistence) or clearly marked "Coming soon" with no fake content visible.

**Rationale:** Showing non-functional content as if it were real actively erodes user trust. The correct short-term fix is to hide or clearly gate these tabs if they can't be built immediately.

---

### 8. /pipelines/create/ai is removed

**Decision:** `/pipelines/create/ai` redirects to `/pipelines/create` (or is removed entirely). AI pipeline creation is the global drawer (Cmd+K), not a dedicated page.

**Rationale:** The route is a dead redirect to `/?openAi=1` which no longer works. It exists only as a vestige of an earlier AI implementation. Leaving it in place creates broken experiences for users who navigate directly to it.

---

*Updated 2026-05-11 via product:model*
