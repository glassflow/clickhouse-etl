---
type: audit
product: GlassFlow ClickHouse ETL
tier: pro
status: complete
created: 2026-05-11
updated: 2026-05-11
skill: product:audit
---

# Product Audit — GlassFlow ClickHouse ETL

## What This Product Is

A self-hosted UI for configuring, deploying, and monitoring data pipelines that ingest from Kafka or OTLP sources and output to ClickHouse — targeting data engineers and DevOps teams, with a secondary aspiration of being accessible to less technical analysts.

## Revamp Goal

Consolidate the product into a coherent, enterprise-grade platform that:
1. Applies a consistent design language across every surface (no per-feature drift)
2. Provides equal-quality experience before deployment (pipeline creation) and after (monitoring, incident management, observability)
3. Establishes canonical patterns that enable fast, confident iteration on new features
4. Graduates from "config generator" to "full pipeline lifecycle management platform"

---

## Screen Inventory

| Screen | Route | Purpose | Status | Keep / Fix / Remove |
|--------|-------|---------|--------|---------------------|
| Dashboard | `/dashboard` | System overview — pipeline health summary, aggregate stats, alert feed | Mixed (real stats, mock feeds) | **Fix** — promote to true home; wire real incident/activity feeds |
| Home (wizard entry) | `/home` | Legacy pipeline list + wizard launch via HomePageClient | Real | **Fix** — clarify role vs Dashboard; may merge or redirect |
| Pipeline List | `/pipelines` | Full CRUD pipeline list with status, quick actions, bulk ops | Real | **Fix** — SSE not wired; bulk actions incomplete |
| Wizard | `/pipelines/create` | 10-step guided pipeline creation flow | Real | **Fix** — no draft save; insufficient in-step guidance |
| AI Journey | `/pipelines/create/ai` | **DEAD ROUTE** — legacy redirect to `/?openAi=1`; replaced by global AI drawer | Broken | **Remove/redirect** — confuses users; AI is now Cmd+K global |
| Pipeline Overview | `/pipelines/[id]/overview` | Pipeline detail — config summary, status, quick actions | Real | **Fix** — no revision history; no conflict detection |
| Pipeline Canvas | `/pipelines/[id]/canvas` | Visual editor for existing pipeline config | Partial | **Fix** — no revision switching; no draft concept |
| Standalone Canvas | `/canvas` | Ephemeral visual pipeline builder (no pipeline context) | Partial | **Fix** — no save; navigating away loses all work; unclear nav context |
| Pipeline Metrics | `/pipelines/[id]/metrics` | VictoriaMetrics time-series charts + hero KPIs | Real | **Keep** — solid; expand metric breadth |
| Metrics Drill-down | `/pipelines/[id]/metrics/[query]` | Per-metric deep-dive view | Real | **Keep** |
| Pipeline Logs | `/pipelines/[id]/logs` | LogsQL free-form + live tail via VictoriaLogs | Real | **Keep** — add export; validate LogsQL client-side |
| Library Links | `/pipelines/[id]/library-links` | Shows which library items this pipeline pins | Real (read-only) | **Fix** — no inline version upgrade |
| Pipeline Settings | `/pipelines/[id]/settings` | **STUB** — EmptyState placeholder | Missing | **Build** — critical surface; users expect to find config/env here |
| Global Logs | `/pipelines/logs` | Unscoped log viewer (all pipelines, no filter) | Partial | **Demote to dev/internal only** — not pipeline-scoped, confuses users |
| Library | `/library` | CRUD for reusable artifacts — connections, schemas, transforms | Partial (dedup/filter mock) | **Fix** — dedup+filter tabs are fake; folder navigation not wired |
| Connection Detail | `/library/connections/[kind]/[id]` | Connection read + usage/blast-radius | Real | **Fix** — add test-connection button; inline edit |
| Schema Detail | `/library/schemas/[id]` | Schema + version history + usage | Real | **Fix** — no version creation UI button |
| Transform Detail | `/library/transforms/[id]` | Transform + inline code editor | Partial | **Fix** — no validate/test; save affordance unclear |
| Dedup Config Detail | `/library/dedup/[id]` | Dedup config detail | **Mock only** | **Build or hide** — false affordance |
| Filter Config Detail | `/library/filter/[id]` | Filter config detail | **Mock only** | **Build or hide** — false affordance |
| Observability Top-level | `/observability` | **STUB** — "Coming soon" | Missing | **Build** — highest-visibility gap post-deployment |
| Pipeline Health (legacy) | `/observability/[id]` | Per-pipeline health + DLQ + notifications | Real | **Migrate** — should live under `/pipelines/[id]/` tab pattern |
| Stack Admin | `/workspace/observability` | VictoriaMetrics/Logs stack info — retention, fan-out | Real (read-only) | **Relocate** — belongs in a settings/admin section, not observability |
| Notifications | `/notifications` | Notification event list | Real | **Review** — unclear how it relates to per-pipeline notification channels |
| Notification Settings | `/notifications/settings` | Channel config | Real | **Review** — duplication risk with per-pipeline notification config |
| Welcome | `/welcome` | Onboarding/welcome page | Unknown | **Review** — unclear when this surfaces vs Dashboard first-run state |
| Dev Gallery | `/dev/components` | Design system component gallery | Dev-only | **Keep as dev tool** — not user-facing |
| Test Routes | `/test-health`, `/test-pipeline-health` | Dev/QA endpoints | Dev-only | **Keep as dev tools** |

---

## Extracted Object Model

| Object | Where found | Consistent? | Notes |
|--------|-------------|-------------|-------|
| `Pipeline` | `src/types/pipeline.ts`, store, API routes | ✅ | Core entity; id, name, status, config blob |
| `PipelineConfig` | `src/types/pipeline.ts`, store slices | ✅ | The serializable config handed to the Go backend |
| `PipelineStatus` | `src/types/pipeline.ts`, `PIPELINE_STATUS_MAP` | ✅ | 10 states including transitional; see State Language Audit |
| `KafkaConnection` | Library DB schema, `src/modules/kafka/types.ts` | ✅ | Bootstrap servers + auth; stored in `ui_library` DB |
| `ClickHouseConnection` | Library DB schema, `src/modules/clickhouse/types.ts` | ✅ | Host, port, credentials; stored in `ui_library` DB |
| `Schema` | `src/types/schema.ts`, Library | ✅ | Named field list; derivedFrom Kafka topic or manual |
| `DeduplicationConfig` | Store slice, wizard step | ⚠️ | Library tab exists but is mock-only; not persisted |
| `FilterConfig` | Store slice, wizard step | ⚠️ | Library tab exists but is mock-only; not persisted |
| `TransformationConfig` | Store slice, wizard step | ⚠️ | Naming inconsistent: `transformation` vs `transform` |
| `PipelineRevision` | `src/app/ui-api/pipelines/[id]/revisions` | ✅ | Snapshot history; no UI to surface or switch between revisions |
| `LibraryReference` | `pipeline_references` Drizzle table | ✅ | Pipeline → pinned library item version links |
| `PipelineIntentModel` | `src/modules/ai/types.ts` | ✅ | AI chat output → config bridge; never persisted to DB |
| `NotificationChannel` | `src/notifications/` | ✅ | Per-pipeline notification endpoint config |
| `PipelineHealth` | `/ui-api/pipeline/[id]/health` | ✅ | Status, DLQ state; 30s cache |
| `Folder` | Library DB schema | ⚠️ | Table exists, not wired to UI navigation |
| `Environment` | Pipeline tags/labels | ⚠️ | Concept mentioned by user; represented as labels, no dedicated UI surface or filter |

---

## Identified Inconsistencies

1. **Two "home" surfaces with overlapping function.** `/home` (HomePageClient with pipeline list + wizard launch) and `/dashboard` both present pipeline information. The sidebar Create button and the `/home` wizard entry are different code paths to the same outcome. Users who arrive at `/dashboard` vs `/home` get meaningfully different UIs for no apparent reason.

2. **Canvas in two unrelated contexts, same component name.** `/canvas` (standalone, ephemeral, no pipeline identity) and `/pipelines/[id]/canvas` (editing an existing pipeline) use the same `CanvasView` component but serve completely different purposes — one creates, one edits. There is no UI differentiation that explains this to a user.

3. **Observability fragmented across three separate surfaces.** `/observability` (stub), `/observability/[id]` (per-pipeline health/DLQ legacy route), `/workspace/observability` (stack admin), plus `/pipelines/[id]/metrics` and `/pipelines/[id]/logs` tabs. A user wanting to understand "what is happening with my pipelines?" has no single starting point.

4. **Library shows mock tabs as if they were real.** The `/library/dedup` and `/library/filter` tabs render with content but have no real API routes behind them. A user who creates a dedup config in the wizard, then navigates to Library expecting to find it, finds fake data. This actively erodes trust.

5. **`/pipelines/create/ai` is a dead route.** It appears in the route tree and may surface via direct navigation or browser history, but redirects to a deprecated URL. AI pipeline creation is now the global drawer (Cmd+K). The route should redirect to `/pipelines/create` or be removed.

6. **`/pipelines/[id]/settings` is a stub with no indication of intent.** EmptyState placeholder with no copy explaining what settings will live there or when. Users who expect to configure environment labels, notification channels, or resource settings here hit a dead end.

7. **Transform/Transformation naming is inconsistent.** The wizard step key is `transformation-configurator`, the store slice uses `transformation`, the library route is `/library/transforms`, and the Drizzle entity is `transforms`. The concept has three different names across the same surface.

8. **"Workspace" is undefined as a concept.** It appears only in `/workspace/observability` (stack admin panel). There is no other workspace concept in the nav or product. Either expand it into a meaningful section (settings, admin, stack config) or relocate the stack admin panel.

9. **No environment context in the main navigation.** Users work across staging/production/dev environments via pipeline labels, but the current environment is never surfaced in the nav or header. A user has no persistent signal of which "environment" they're looking at.

10. **Global unscoped log viewer (`/pipelines/logs`) is exposed in the shell.** This route shows all system logs without pipeline scoping. It appears to be a debugging tool but exists in the same URL namespace as user-facing pipeline routes. Users who stumble on it see system-level noise.

---

## Terminology Gaps

| Concept | Names used today | Recommended canonical term | Notes |
|---------|-----------------|---------------------------|-------|
| A reusable pipeline processing step definition | "Transform", "Transformation", "TransformationConfig" | **Transform** (noun) / **Transformation** (section header) | Standardize to "Transform" in routes/code, "Transformation" in UI headings |
| The per-pipeline visual editor | "Canvas" (standalone route), "Canvas" (pipeline tab) | **Pipeline Canvas** (editing) / **New Pipeline Canvas** (creation) | Disambiguate in nav labels |
| System health monitoring | "Observability", "Health", "Monitoring" | **Observability** for the section; **Health** for per-pipeline status | Reserve "Observability" for the top-level section |
| A reusable connection config saved in the library | "Connection", "Saved Connection", "Connection Config" | **Connection** | Already fairly consistent |
| A filter definition | "Filter", "FilterConfig", "filter-configurator" | **Filter** | Consistent in user-facing text; inconsistent in code |
| Workspace section (stack admin) | "Workspace", "Stack Admin", "Observability Stack" | **Settings** or **Admin** | "Workspace" is ambiguous; move to a Settings/Admin section |
| Environment labels | "Environment", "Tags", "Labels" | **Environment** | Make this a first-class filter concept, not just a label |
| The library of reusable artifacts | "Library", "Component Library", "Saved Configurations" | **Library** | Already consistent; reinforce this as the canonical term |

A formal **Product Glossary** (`docs/product/glossary.md`) should be created as a companion to this audit. Every new term introduced in a feature spec should be checked against the glossary first.

---

## State Language Audit

| State | How it's shown today | Problem |
|-------|---------------------|---------|
| `active` / running | Green StatusBadge | Clear |
| `starting` / deploying | StatusBadge | Transitional; users don't know how long this lasts or what triggers it |
| `paused` | StatusBadge | Clear |
| `pausing` | StatusBadge | Transitional; can appear alongside incorrect "running" state briefly |
| `resuming` | StatusBadge | Transitional; same issue |
| `stopped` | StatusBadge | Clear, but "stopped" vs "paused" distinction is not explained anywhere |
| `stopping` / `terminating` | StatusBadge | Transient; can show inconsistent states (known bug, out of scope) |
| `failed` | StatusBadge | Clear but no inline explanation of *why* failed or what to do |
| Canvas unsaved state | Nothing visible | **Critical gap** — user has no signal that their canvas changes aren't saved |
| Library item (mock) | Same UI as real items | **Critical gap** — no "unavailable" or "coming soon" state shown |
| Pipeline settings (stub) | EmptyState | Poor — no explanation, no ETA signal |
| Wizard draft (abandoned) | No state persisted | **Gap** — closing wizard loses all work silently |

---

## Information Architecture Gaps

1. **No definitive home base.** After login, users land at `/dashboard` but the Create button sidebar sends them through `/home` as an intermediate step. The Dashboard, Home, and sidebar "Create" all serve overlapping roles. There should be one clearly dominant first surface.

2. **Creation entry point is a 3-way split.** "Create pipeline" can mean: (a) clicking Create in the sidebar → modal or `/home`, (b) navigating directly to `/pipelines/create`, (c) going to `/canvas`. These paths are not presented as equal choices in a structured way — they're scattered across the nav.

3. **Observability has no landing page.** The top-level `/observability` route is a stub. Per-pipeline health is buried under `/observability/[id]` (a legacy route) and split across `/pipelines/[id]/metrics` and `/pipelines/[id]/logs`. Stack admin is under `/workspace/observability`. There is no "observability home" that gives a user an overview of system health.

4. **Library incompleteness is invisible to users.** Dedup and filter tabs in Library render with content but contain mock data. Users who come to Library expecting to manage these configs will be confused or misled. Either mark them clearly as "coming soon" or hide them until real.

5. **No environment context in navigation.** Teams use staging/production/dev labels on pipelines, but the current environment is not surfaced at the shell level. Users must filter per page rather than setting a global context.

6. **Pipeline details tabs are inconsistently structured.** A pipeline has: Overview, Canvas, Metrics, Logs, Library Links, Settings. "Canvas" is a creation tool repurposed as an editing tab. "Settings" is empty. The relationship between what you configured in the wizard and what you see in these tabs is implicit, not explained.

7. **Stack admin is mislabeled and misplaced.** `/workspace/observability` is not observability — it's infrastructure administration (stack versions, retention policies). It should be in an Admin or Settings section, not under a user-facing Observability section.

8. **No glossary or onboarding orientation.** First-time users encounter terms like "deduplication key," "schema derivation," "OTLP source," and "library reference" with no in-app explanation. There is no getting-started guide, tooltips system, or glossary link.

---

## Prioritized Problem List

| Priority | Problem | Impact | Effort |
|----------|---------|--------|--------|
| 1 | **No unified design vision to guide new screens** — Design tokens exist but there is no screen-level design standard or reference that teams/AI can follow when building new features. Every new surface makes local decisions. | High — every new feature ships inconsistent | Medium — needs a design spec document + applied to 5–6 key screens |
| 2 | **Observability surface is fragmented and largely missing** — The post-deployment experience is the product's weakest area. `/observability` is a stub. Per-pipeline health, DLQ, and metrics are in three different places with no unifying structure. | High — users can't monitor pipelines effectively | High — requires building the observability landing + migrating legacy routes |
| 3 | **Information architecture has no clear hierarchy** — Dashboard, Home, and the sidebar Create button serve overlapping roles. Observability is split 3 ways. Library has fake content. Navigation doesn't reflect how the product actually works. | High — confuses users, especially new ones | Medium — mostly IA decisions + route restructuring + some stubs to build |
| 4 | **Creation flow lacks guidance and safety** — Wizard steps have no contextual help, no field-level explanations, no draft/resume capability. Abandoning the wizard loses all work silently. | High for non-technical users | Medium — copy/tooltip work + draft persistence |
| 5 | **Library dedup and filter tabs are mock-only with no indication** — False affordances. Users who navigate here are misled. | Medium — breaks trust | Low — either build them or clearly mark as coming soon |
| 6 | **Missing enterprise-readiness signals** — Settings tab is empty, no environment context in nav, no glossary, no in-app onboarding. Product doesn't feel "done" to a first-time enterprise user. | Medium — adoption risk | Medium — several small items that together signal maturity |
| 7 | **Terminology drift** — "Transform" vs "Transformation", "Canvas" dual meaning, "Workspace" undefined. No canonical glossary to prevent future drift. | Low-medium — confusion accumulates over time | Low — glossary doc + 1-pass rename in UI labels |

---

## What Must Not Change

- **Orange accent color** — core brand identity; must be the primary interactive color across all surfaces
- **Dark theme** — the app is dark-only by design (`ThemeProvider defaultTheme="dark"`, `enableSystem=false`); no light-theme branches
- **Business logic and state management architecture** — Zustand slice pattern, Zod schema validation, service layer, API proxy routes; all solid and should not be touched in this round
- **Pipeline config format** — the JSON/YAML blob handed to the Go backend; any UI change must produce the same contract
- **Three creation lanes** — Wizard, Canvas, and AI (feature-flagged) are all intentional; none to be removed

---

## Recommended Next Steps

**Immediate (this round):**

1. **`product:model`** — Formalize the target product model. Define what the product IS (not what it currently does), the canonical object model, and the 3–4 user journeys that must work end-to-end. This becomes the north star that prevents further drift.

2. **Create `docs/product/glossary.md`** — A 15-term glossary covering Pipeline, Source, Connection, Schema, Transform, Filter, Deduplication, Library, Canvas, Environment, Observability, Health, Revision, Draft, and Workspace. Used as a checklist for all future feature work.

**After model is defined:**

3. **`product:journey`** — Map the 3 creation journeys (Wizard, Canvas, AI) and the 2 monitoring journeys (per-pipeline health, system-wide observability) as explicit flows with entry/exit points, so IA decisions can be made against them.

4. **`product:shape "[Priority 3] IA consolidation"** — Define the target navigation structure, resolve the Dashboard/Home ambiguity, and produce a clear route map before any screen gets rebuilt.

---

*Updated 2026-05-11 via product:audit*
