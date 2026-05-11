---
type: shaped-pitch
product: GlassFlow ClickHouse ETL
feature: IA Consolidation
tier: pro
status: ready-to-build
created: 2026-05-11
updated: 2026-05-11
skill: product:shape
---

# Shaped Pitch: IA Consolidation

## Problem

Users who open GlassFlow today face a fragmented navigation that doesn't match how the product actually works:

- Clicking **Create** redirects through `/home` — a separate page that serves as an awkward intermediary before the wizard. New users have no modal, no lane choice, no clear starting point.
- **Canvas** appears as a top-level sidebar nav item, implying it's a destination to browse — but it's actually a creation tool. Users navigating to it expecting to find their pipeline work find an empty canvas.
- When something goes wrong with a pipeline, there is **no clear place to look**. `/observability` shows "Coming soon." Health data is buried in a legacy route (`/observability/[id]`). Stack admin is under `/workspace/observability` — a section with no defined meaning.
- The **Library** shows Deduplication, Filter, and Schema tabs that render with mock data as if they were real. Users who navigate there expecting to manage saved configs are misled.
- **ClickHouse metrics** on the pipeline detail page are aggregated across all pipelines — a user monitoring one pipeline sees numbers that include every other pipeline in the system.

The result: users don't know where to go to create a pipeline, don't know where to look when something breaks, and can't trust the numbers they do see.

## Appetite

**2 weeks.** This is a maximum. If scope needs to be cut to ship in 2 weeks, cut scope — not time.

## Solution Outline

Consolidate the product around its four real areas — **Dashboard, Pipelines, Library, Observability** — and remove every surface that contradicts that structure.

The Create flow becomes a modal (not a page) offering three equal creation lanes. Dashboard becomes the true home base with a first-run welcome state. Observability becomes a real section with per-pipeline health, DLQ, and properly scoped metrics and logs. Library delivers one thing well: working Connections (Kafka + ClickHouse) that can be saved, tested, and reused from the wizard and canvas. Everything that is not yet built gets an honest "coming soon" state instead of fake content.

Infrastructure-heavy pieces (per-pipeline-scoped metrics, cross-pipeline health summary for the Observability landing) depend on backend API contracts being delivered before UI work starts on those surfaces.

## User Flow

**Moment A — New user, first pipeline:**
1. User opens product → lands on **Dashboard**
2. Dashboard shows first-run empty state: welcome message, "You don't have any pipelines yet," prominent **Create pipeline** CTA
3. User clicks Create (sidebar button or dashboard CTA) → **Create modal** opens with three options: Wizard / Canvas / AI Assistant (AI shown only if API key configured)
4. User selects Wizard → wizard opens at Step 1. No detour through `/home`.

**Moment B — Experienced user, degraded pipeline notification:**
1. User receives notification (badge, email, webhook) that a pipeline is degraded or in error
2. Notification links directly to:
   - **Pipeline detail → Overview** for low-severity alerts (status change, brief lag spike)
   - **Observability → Pipeline health** for high-severity incidents (pipeline failed, DLQ threshold exceeded, metrics anomaly)
3. User arrives at the relevant surface with health data, DLQ state, and metrics visible without further navigation

## What's Included

- [ ] **4-section sidebar nav** — Dashboard, Pipelines, Library, Observability. No Workspace section. No Canvas as a standalone nav item.
- [ ] **Create modal** — triggered by the sidebar Create button. Presents Wizard / Canvas / AI options. AI option hidden if no AI API key is configured. No redirect to `/home`.
- [ ] **Dashboard first-run empty state** — clear welcome message, zero-pipeline explanation, prominent Create CTA, guidance toward Library as the first step for power users.
- [ ] **`/home` route killed** — no nav links point to it. Route itself redirects to `/dashboard`. Code preserved but unreachable from the UI.
- [ ] **`/pipelines/create/ai` dead route removed** — redirects to `/pipelines/create`. AI creation is the global drawer (Cmd+K), not a page.
- [ ] **`/workspace/observability` relocated** — route redirects to `/observability/stack` (or equivalent path under Observability). Workspace nav label removed.
- [ ] **Observability landing page** — real cross-pipeline health summary: pipeline count by status, aggregate DLQ totals, aggregate throughput. Not "coming soon."
- [ ] **Per-pipeline Observability** — structured health checklist (Kafka connected → ingestor consuming → processing → ClickHouse writing → DLQ healthy), DLQ viewer with event examination and consume/discard actions, link through to per-pipeline metrics and logs.
- [ ] **Per-pipeline metrics properly scoped** — metrics on `/pipelines/[id]/metrics` show data for that pipeline only. Time-range selector (default: last 1 hour). Not aggregated across all pipelines.
- [ ] **Library Connections (Kafka + ClickHouse) — full quality** — create, test, name, save, edit, delete. Connections surfaced as "pick from Library" option in wizard connection steps and canvas node drawers. Save-to-Library nudge after successful connection test in wizard and canvas.
- [ ] **Library Schemas, Dedup, Filter tabs** — show honest "coming soon" state. No mock data. No fake content.
- [ ] **Notification links are severity-aware** — low-severity links to Pipeline detail; high-severity links to Observability per-pipeline view.

## What's Excluded (No-Gos)

- **Draft persistence** — not in this effort. Wizard and canvas still lose work on navigate-away. Deferred to its own pitch.
- **Pipeline Settings tab** — remains a stub. May get placeholder copy explaining what will go there, but no settings are implemented.
- **Library Schemas real API routes** — deferred. Schema management in the Library is a separate workstream.
- **Library Dedup + Filter real API routes** — deferred. These tabs are marked coming soon and hidden from users as live features.
- **New AI creation surfaces** — the dead `/pipelines/create/ai` route is removed, but no new AI UI is added. AI drawer (Cmd+K) stays as-is.
- **Observability custom query builder or date comparison** — time-range selector is the only filter. No custom PromQL, no period-over-period comparison, no data export. Show the data cleanly; don't build Grafana.
- **Library credential encryption or rotation** — Connections store credentials as they do today. No encryption-at-rest UI, no secret rotation, no org-level access controls.
- **Create modal onboarding tour** — the modal presents three options with concise descriptions. No tooltips, no "which lane is right for me?" wizard, no feature tour.
- **Incident response workflow** — the product surfaces where the problem is and points toward metrics/logs. It does not guide users through a step-by-step incident resolution or navigate them back to specific config steps.

## Risks

- **Per-pipeline metric scoping requires backend API contract** — the current ClickHouse-based metrics are aggregated across all pipelines. Per-pipeline metric scoping (via VictoriaMetrics with `pipeline_id` label filtering) requires the backend team to confirm the query contract before the UI can build the time-series charts correctly. **Mitigation:** confirm API contract with backend team before starting Observability UI work. UI work on other IA changes can proceed in parallel.

- **Observability cross-pipeline summary may need a new API endpoint** — the landing page needs an aggregated health view (counts by status, total DLQ, total throughput). Currently no single endpoint returns this. The existing `/ui-api/pipeline` list endpoint can be used as a fallback (aggregate client-side), but a dedicated stats endpoint would be more efficient. **Mitigation:** use client-side aggregation from the pipeline list as a starting point; optimize with a dedicated endpoint if performance is a problem.

- **Library "pick from Library" wiring in wizard and canvas** — the wizard connection steps and canvas node drawers don't currently surface saved Library connections as selectable options. Adding this touchpoint requires changes in both the wizard flow and canvas node drawers. **Mitigation:** scope this as a single "Library connection picker" component reused in both places — not two separate implementations.

## Rabbit Holes

- **Observability becoming a metrics analytics tool** — it will be tempting to add custom PromQL query input, saved query presets, metric comparisons, CSV export, and alerting threshold configuration. These are valuable but each one adds days. The scope is: show the canonical set of pipeline metrics cleanly, with a time-range selector. Stop there.

- **Library Connections becoming a credential manager** — once connections are saved, questions arise about encryption at rest, who can see them, how to rotate a compromised password, and version history. None of this is in scope. Connections are saved, tested, and reused. That's it.

- **Create modal expanding into an onboarding flow** — it will be tempting to add "recommended for beginners" labels, animated explanations of each lane, or a "not sure? take this quiz" path. The modal's job is to present three clear options. Resist making it a product decision tree.

- **Dashboard first-run state becoming a tutorial** — the empty state should communicate "you have no pipelines, here's how to start" — not a multi-step product tour. One clear message, one clear action, done.

## Done Means

- [ ] A user who navigates to `/observability` sees a real cross-pipeline health overview — pipeline counts by status, aggregate DLQ total, aggregate throughput. Not a "Coming soon" placeholder.
- [ ] A user who clicks **Create** anywhere in the product sees a modal presenting Wizard / Canvas / AI options. There is no redirect to `/home`.
- [ ] `/home` has zero nav links pointing to it. Navigating to `/home` redirects to `/dashboard`.
- [ ] Library Connections work end-to-end: a user can save a Kafka connection, find it in the Library, and select it from the wizard's Kafka connection step and from a canvas KafkaSource node drawer.
- [ ] Library Schema, Dedup, and Filter tabs display a "coming soon" state — no mock data is visible as if it were real.
- [ ] Per-pipeline metrics on `/pipelines/[id]/metrics` show data scoped to that pipeline only, with a working time-range selector (minimum: 1h / 6h / 24h options).

---

## Dependencies

| Dependency | Owner | Needed for | Blocker? |
|------------|-------|-----------|----------|
| Per-pipeline metric query contract (VictoriaMetrics `pipeline_id` label) | Backend team | Per-pipeline metrics UI | Yes — UI cannot build before contract is confirmed |
| Aggregated health stats endpoint (or confirmation that client-side aggregation is acceptable) | Backend team | Observability landing page | Partial — client-side fallback is possible |
| Library Connection API routes confirmation | UI team | Already built — verify CRUD routes are complete | No |

---

*Updated 2026-05-11 via product:shape*
