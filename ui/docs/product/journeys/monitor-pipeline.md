---
type: journey
product: GlassFlow ClickHouse ETL
journey: Monitor Pipeline Post-Deployment
tier: pro
status: complete
created: 2026-05-11
updated: 2026-05-11
skill: product:journey
---

# Journey: Monitor Pipeline Post-Deployment

## User Goal

"I want to know my pipeline is healthy, data is flowing from Kafka to ClickHouse, and I'll catch any problems before they cause data loss."

Two modes in one journey:
- **Passive confidence** — scan health at a glance, confirm everything is green, move on
- **Active investigation** — drill into metrics, logs, and DLQ when something looks wrong

## Triggers

All of the following:
- **Post-deploy check** — user just deployed a pipeline and wants to confirm data is flowing
- **Routine check** — user opens the product to see overnight or weekly pipeline health
- **Alert / notification** — a notification channel reported a pipeline error or DLQ threshold
- **Colleague report** — "the data in ClickHouse looks stale" or "something feels off"

## Entry Points

- **Dashboard** — for routine checks and alert-triggered visits (passive glance)
- **Pipeline detail → Overview tab** — for post-deploy confirmation
- **Notification badge** — for alert-triggered investigations

## Preconditions

- [ ] At least one Pipeline is deployed and in `active` state
- [ ] Basic metrics (pipeline status, DLQ count, events in/out rate) are always available via the Go backend health API — regardless of observability stack configuration
- [ ] Full metrics and logs (VictoriaMetrics + VictoriaLogs) are optionally available when the observability stack is configured at install time
- [ ] Users may also connect their own external tools (Grafana, custom dashboards) to the OTLP collector — the product must still show its own baseline metrics independently

---

## Two Metric Tiers

| Tier | Always available | Requires full observability stack |
|------|-----------------|----------------------------------|
| **Baseline** | Pipeline status (active/paused/failed), DLQ count, DLQ unconsumed count, events in/out rate, basic latency | — |
| **Full** | — | Time-series charts, per-component drill-down, structured logs (LogsQL), historical trend comparison |

The product must function usefully at the baseline tier. The full tier is the deep investigation tool.

---

## Steps — Passive Confidence Check (30-second glance)

| # | User action | System response | Screen |
|---|-------------|-----------------|--------|
| 1 | Opens product; lands on Dashboard | Dashboard shows system health summary: total pipelines, count by status (active/paused/failed/degraded), aggregate DLQ total, aggregate throughput | Dashboard |
| 2 | Scans pipeline status cards — all show active + healthy | All pipelines show green status; DLQ counts at 0 or within acceptable range; throughput indicators normal | Dashboard |
| 3 | User is satisfied; closes or moves to other work | No action needed | — |

---

## Steps — Post-Deploy Confirmation

| # | User action | System response | Screen |
|---|-------------|-----------------|--------|
| 1 | Lands on Pipeline detail page after completing wizard | Pipeline shows `starting` → transitions to `active` within seconds | Pipeline detail — Overview |
| 2 | Observes pipeline status badge | Status shows `active` confirmed by Go backend API health check | Pipeline detail — Overview |
| 3 | Checks DLQ indicator | DLQ shows 0 unconsumed messages — healthy signal | Pipeline detail — Overview |
| 4 | Checks data-flow indicators | Events/sec from Kafka visible; events/sec to ClickHouse visible; latency within normal range | Pipeline detail — Overview |
| 5 | User satisfied that data is flowing | **[Gap: no explicit "data is flowing" confirmation today — metrics currently aggregated across all pipelines, not pipeline-scoped. ClickHouse metrics are unreliable as a result.]** | Pipeline detail — Overview |

---

## Steps — Active Investigation (something looks wrong)

| # | User action | System response | Screen |
|---|-------------|-----------------|--------|
| 1 | Notices a warning signal: pipeline in error/failed state, DLQ growing, unexpected metric values, or external report of stale data | Dashboard highlights affected pipeline; Pipeline status badge shows error/degraded state | Dashboard or Pipeline detail |
| 2 | Navigates to affected Pipeline detail → Overview | System shows current status, DLQ count, and last-known metrics | Pipeline detail — Overview |
| 3 | Follows structured health checklist (component-by-component): | System shows per-component health indicators: | Pipeline detail — Observability |
| | — Is Kafka connection OK? | Source connected indicator + events read/sec | |
| | — Is ingestor consuming events? | Consumer lag metric + events consumed/sec | |
| | — Are events passing through processing? | Per-component pass-through rates (dedup, filter, transform) | |
| | — Are events being written to ClickHouse? | Events written/sec + write error count | |
| | — Is DLQ healthy? | DLQ count + unconsumed count + rate of new DLQ entries | |
| 4 | Identifies the failing component from the checklist | Failing component highlighted; system points toward relevant metrics/logs section | Pipeline detail — Observability |
| 5 | Clicks through to full metrics for the failing component | Time-series charts for that component's key metrics; selects time range (default: last 1 hour) | Pipeline detail — Metrics |
| 6 | Checks logs for the failing component | LogsQL query pre-populated for that component; user can refine or run free-form queries | Pipeline detail — Logs |
| 7 | Identifies root cause | — | — |
| 8 | Takes action: restarts pipeline, consumes/discards DLQ events, or notes the issue for configuration change | System executes the action; pipeline status updates | Pipeline detail — Overview or DLQ viewer |

---

## Required Decisions

- **Time range for metrics:** 1 hour / 6 hours / 24 hours / 7 days / custom. **Default: last 1 hour.**
- **Which pipeline to investigate:** User navigates from Dashboard summary → individual Pipeline. No default — user selects by urgency.
- **Restart vs. investigate before restarting:** Both options always available on a failed pipeline. **Recommended: investigate first** (a restart without understanding the cause will likely fail again). Restart is a one-click action; investigation is accessible via "View details" or "Why did this fail?" link.
- **DLQ: consume vs. discard:** When DLQ events are present, user can (a) examine events, (b) reprocess (consume), or (c) discard. **Default: examine first.** Discard is a destructive action and should require confirmation.
- **DLQ event examination:** User can view the shape and content of failed events to understand why they were rejected and what error the processing component reported.

---

## Failure States

| Step | Failure | What user sees | How user recovers | Gap |
|------|---------|---------------|-------------------|-----|
| 1 — Dashboard | Pipeline shows `failed` or `stopped` unexpectedly | Status badge shows failed state; alert may have triggered via notification channel | Navigate to pipeline detail for error details + restart option | **Gap:** error details need enough context to understand why, not just that it failed. If root cause is not deterministic, system should show explicit next-investigation steps (logs / metrics / DLQ) |
| 3 — Component health | DLQ growing: events are being rejected by a processing component | DLQ count rising; unconsumed messages count visible | Examine DLQ events (view event shape + error details from processing component); then decide consume or discard | **Gap:** DLQ event viewer must show the error message that caused the event to land in DLQ, not just the event body |
| 3 — Component health | Metrics anomaly: events read ≠ events written; latency spike; throughput drop | Metric values outside normal range; pipeline still shows `active` | Navigate to internal observability for open-ended investigation; compare time ranges to identify when the anomaly started | **Gap:** no baseline or alert threshold today — user must notice the anomaly themselves. Future: automatic alerting when metrics cross thresholds |
| 5 — Metrics drill-down | Full observability stack not configured | Baseline metrics only (status, DLQ, basic rates); no time-series charts | User must use external tools (Grafana, etc.) or configure the observability stack | By design — but the product should clearly communicate this state and not show broken/empty chart panels |
| 6 — Logs investigation | User doesn't know LogsQL | **Deferred** — needs internal observability planning | **Deferred** | Planned: pre-built log queries per component; guided log views without requiring LogsQL knowledge |
| 8 — Restart action | Pipeline fails to restart (same root cause) | Pipeline returns to `failed` state | User must investigate further before retrying | Gap: the product should prevent "restart loops" by suggesting investigation if restart fails more than once |

---

## Completion State

**Passive check:** User sees all target pipelines in `active` state with DLQ at 0 (or within acceptable threshold) and basic data-flow metrics showing positive numbers. Tab closed with confidence.

**Active investigation:** The specific component causing the issue has been identified. User has taken an action (restart, DLQ consume/discard, or flagged for configuration change). Pipeline returns to `active` state with health metrics within acceptable range.

The product does not need to navigate the user back to configuration steps. Its responsibility is to surface the problem clearly and point toward the right investigation area.

---

## Follow-Up Actions

- **If pipeline is healthy:** User moves on. Optionally: user configures a notification channel so they don't need to manually check next time.
- **If an issue was found and resolved:** User may want to review the configuration (filter too aggressive, dedup window too narrow, schema mismatch) — but the product should surface the *what*, not force the *how*.
- **If root cause is a configuration problem:** User goes back to Pipeline → Canvas or Pipeline → Overview to edit and redeploy. This path is not yet smooth — no guided "fix this config" flow exists. Deferred for a later phase.
- **Notification channel setup:** Users who arrived via alert are already set up. Users who discovered a problem manually should be prompted to configure a notification channel after resolving it ("Want to be notified next time?").

---

## What This Journey Requires the Product to Build

| Requirement | Priority | Current state |
|-------------|----------|---------------|
| Pipeline-scoped metrics (not aggregated across all pipelines) | **P0** | ClickHouse metrics are cross-pipeline today — unreliable |
| Per-component health checklist on Pipeline detail | **P0** | Not built — just tabs, no structured diagnostic flow |
| DLQ event viewer with error details (why the event failed) | **P0** | DLQ count visible; event examination not available |
| Data-flow confirmation on post-deploy landing | **P0** | Missing — pipeline details shows config, not data flow |
| Restart action on failed pipeline from detail page | **P1** | Available in list; unclear on detail page |
| Time-range selector for metrics | **P1** | Fixed time range today |
| Graceful "observability stack not configured" state | **P1** | Currently shows broken/empty panels |
| Notification channel prompt after incident resolution | **P2** | Not built |
| Automatic alerting on threshold breach | **P2** | Not built — requires VictoriaMetrics alerting rules |
| Pre-built log queries per component (guided log views) | **P2** | Deferred — needs internal observability planning |

---

*Updated 2026-05-11 via product:journey*
