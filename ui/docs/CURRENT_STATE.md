# GlassFlow UI — Current State Map

> Living document. Update when surfaces change functional or visual status.
> Last updated: 2026-05-08 | Branch: `ui-ux-revamp-2.0`

---

## Legend

**Data source:** `real` = Go backend / Drizzle / VictoriaMetrics/Logs · `mock` = seed file, in-memory · `mixed` = real for reads, mock for writes (or vice-versa)

**CRUD:** ✅ works end-to-end · 🟡 partial (stubbed or optimistic-only) · ❌ missing

**Visual:** ✅ consistent with design system · 🟡 inconsistent · ❌ placeholder/unstyled

---

## Shell Routes

### `/home`
| | |
|---|---|
| Component | `HomePageClient` |
| Data source | real (`GET /ui-api/pipeline` → Go backend) |
| C | ✅ wizard modal → `POST /ui-api/pipeline` |
| R | ✅ pipeline list |
| U | 🟡 optimistic status/name/tags, no persist |
| D | ❌ no delete from home |
| Visual | 🟡 |
| Gaps | Import via `UploadPipelineModal` has routing/state sync issues; no real-time SSE status subscription |

---

### `/dashboard`
| | |
|---|---|
| Component | `DashboardClient` (server-rendered) |
| Data source | mixed (`GET /ui-api/dashboard/stats` + `/pipelines` → real; incident/activity → mock) |
| C/U/D | ❌ read-only |
| R | ✅ stats + pipeline list |
| Visual | ✅ |
| Gaps | No auto-refresh; incident feed and activity feed are hardcoded mock data; no real backend for those two feeds |

---

### `/canvas`
| | |
|---|---|
| Component | `CanvasView` (no pipeline context) |
| Data source | none (ephemeral canvas state only) |
| C | 🟡 → `POST /ui-api/pipeline` on deploy (wired but untested in isolation) |
| R/U/D | ❌ new-pipeline only |
| Visual | 🟡 |
| Gaps | No save-draft; navigating away loses all work |

---

## Pipelines

### `/pipelines`
| | |
|---|---|
| Component | `PipelinesPageClient` |
| Data source | real (`GET /ui-api/pipeline`) |
| C | 🟡 redirects to `/pipelines/create` |
| R | ✅ |
| U | ✅ pause/resume/stop/rename wired end-to-end |
| D | ✅ `DELETE /ui-api/pipeline/[id]` |
| Visual | 🟡 bulk action bar / saved views not visually consistent |
| Gaps | No server-side pagination; SSE not wired to list (poll only); no bulk pause/delete |

---

### `/pipelines/create`
| | |
|---|---|
| Component | `PipelineWizard` |
| Data source | real (ClickHouse introspection + Kafka introspection + Go backend create) |
| C | ✅ full wizard → `POST /ui-api/pipeline` with optional ClickHouse table pre-creation |
| R/U/D | ❌ not applicable |
| Visual | 🟡 |
| Gaps | No draft save; wizard state lost on navigate-away; error shown only on submit |

---

### `/pipelines/create/ai`
| | |
|---|---|
| Component | Redirect only |
| Data source | none |
| Status | ❌ Legacy redirect to `/?openAi=1` — deprecated, replaced by global AI drawer (ETL-1085) |

---

### `/pipelines/[id]` → redirects to `/pipelines/[id]/overview`

---

### `/pipelines/[id]/overview`
| | |
|---|---|
| Component | `PipelineDetailsModule` |
| Data source | real (`GET /ui-api/pipeline/[id]`) |
| R | ✅ |
| U | ✅ `PATCH /ui-api/pipeline/[id]` |
| C/D | ❌ not applicable |
| Visual | 🟡 |
| Gaps | No revision history visible; no conflict detection |

---

### `/pipelines/[id]/canvas`
| | |
|---|---|
| Component | `CanvasView` (with pipeline context) |
| Data source | real (`GET /ui-api/pipeline/[id]`) |
| R | ✅ loads existing pipeline config |
| U | ✅ canvas changes → `PATCH /ui-api/pipeline/[id]` |
| Visual | 🟡 |
| Gaps | Revision pinning not wired; no way to switch between revisions |

---

### `/pipelines/[id]/metrics`
| | |
|---|---|
| Component | `MetricsTab` |
| Data source | real (`GET /ui-api/pipelines/[id]/metrics` → VictoriaMetrics proxy, scope-enforced) |
| R | ✅ hero cards + 6-chart grid + auto-refresh |
| Visual | ✅ |
| Gaps | Metrics limited to canonical set; no custom PromQL queries; no alerting thresholds |

---

### `/pipelines/[id]/metrics/[query]`
| | |
|---|---|
| Component | `DrillDownView` |
| Data source | real (whitelist of canonical metric keys) |
| R | ✅ |
| Visual | ✅ |
| Gaps | Limited to pre-defined queries |

---

### `/pipelines/[id]/logs`
| | |
|---|---|
| Component | `LogsTab` |
| Data source | real (`GET /ui-api/pipelines/[id]/logs` + `/stream` SSE → VictoriaLogs proxy, scope-enforced) |
| R | ✅ free-form LogsQL queries + live tail |
| Visual | ✅ |
| Gaps | No log export; LogsQL not validated client-side; no log replay |

---

### `/pipelines/[id]/library-links`
| | |
|---|---|
| Component | `LibraryLinksTab` |
| Data source | real (`GET /ui-api/pipelines/[id]/library-links` → Drizzle `pipeline_references`) |
| R | ✅ shows pinned resource versions |
| U | ❌ upgrade requires new revision via canvas |
| Visual | 🟡 |
| Gaps | Read-only; no inline version upgrade |

---

### `/pipelines/[id]/settings`
| | |
|---|---|
| Component | `EmptyState` |
| Data source | none |
| Status | ❌ **STUB** — placeholder only |
| Visual | ❌ |
| Gaps | Entire settings surface missing |

---

### `/pipelines/logs` (global, unscoped)
| | |
|---|---|
| Component | `LogViewer` |
| Data source | client-side, not scope-enforced |
| R | 🟡 (works but exposes all logs, no pipeline_id filter) |
| Visual | 🟡 |
| Gaps | Not pipeline-scoped; intended for infra debugging only |

---

## Library

### `/library`
| | |
|---|---|
| Component | `LibraryClient` |
| Data source | real (Drizzle — connections, schemas, transforms, folders) |
| C | ✅ connections, schemas, transforms |
| R | ✅ all list endpoints |
| U | ✅ connections (PATCH); schemas/transforms via new version |
| D | ✅ with cascade |
| Visual | 🟡 gap-closure done but some inconsistency across tabs |
| Gaps | Folder navigation UI missing (table exists, not wired); dedup/filter tabs are mock-only; bulk delete missing |

---

### `/library/connections/[kind]/[id]`
| | |
|---|---|
| Component | `ConnectionDetail` |
| Data source | real (`GET /ui-api/library/connections/[kind]/[id]` + `/used-by`) |
| R | ✅ detail + usage/blast-radius |
| U/D | ❌ read-only in detail; edit/delete from list only |
| Visual | ✅ |
| Gaps | No test-connection button in detail; no inline edit |

---

### `/library/schemas/[id]`
| | |
|---|---|
| Component | `SchemaDetail` |
| Data source | real (`GET /ui-api/library/schemas/[id]` + `/used-by` + `/versions`) |
| R | ✅ detail + version history + usage |
| C | 🟡 `POST /ui-api/library/schemas/[id]/versions` exists but no UI button to trigger it |
| U/D | ❌ |
| Visual | ✅ |
| Gaps | No version creation UI; no version comparison; no rollback (immutable by design) |

---

### `/library/transforms/[id]`
| | |
|---|---|
| Component | `TransformDetail` |
| Data source | real (`GET /ui-api/library/transforms/[id]`) |
| R | ✅ |
| U | 🟡 inline code editor exists but save UX unclear; `/transform/expression/evaluate` not wired to UI |
| Visual | 🟡 |
| Gaps | No validate/test button; no version history UI; save affordance unclear |

---

### `/library/dedup/[id]`
| | |
|---|---|
| Component | `DedupConfigDetail` |
| Data source | **mock only** (no real API route) |
| C/R/U/D | ❌ mock read only |
| Visual | 🟡 |
| Gaps | No real API routes; no create/edit UI |

---

### `/library/filter/[id]`
| | |
|---|---|
| Component | `FilterConfigDetail` |
| Data source | **mock only** (no real API route) |
| C/R/U/D | ❌ mock read only |
| Visual | 🟡 |
| Gaps | No real API routes; no create/edit UI |

---

## Observability

### `/observability`
| | |
|---|---|
| Component | Static JSX |
| Data source | none |
| Status | ❌ **STUB** — "Coming soon" badge only |
| Visual | ❌ |
| Gaps | Entire top-level observability surface missing |

---

### `/observability/[id]` (pipeline health — legacy route)
| | |
|---|---|
| Component | `PipelineHealthCard` + `DLQViewer` + `NotificationChannelConfig` |
| Data source | real (`GET /ui-api/pipeline/[id]/health` + DLQ + notifications) |
| R | ✅ health + DLQ + notification channels |
| U | ✅ notification channel settings |
| C (consume DLQ) | ✅ `POST /ui-api/pipeline/[id]/dlq/consume` |
| Visual | 🟡 |
| Gaps | 30s cache on health (not real-time); no DLQ replay; no alerting thresholds inline |

---

### `/workspace/observability`
| | |
|---|---|
| Component | `StackAdminPanel` |
| Data source | real (`GET /ui-api/observability/stack`) |
| R | ✅ stack version, retention, fan-out, cardinality |
| U | ❌ read-only |
| Visual | 🟡 |
| Gaps | No configuration UI; informational only |

---

## API Route Summary

### What's fully real and connected
- All `/ui-api/pipeline/*` — full CRUD + status changes + health + DLQ
- All `/ui-api/library/connections/*` — full CRUD + test + used-by
- All `/ui-api/library/schemas/*` + versions — full CRUD + versioning
- All `/ui-api/library/transforms/*` + versions — full CRUD
- All `/ui-api/pipelines/[id]/logs` + `/stream` — VictoriaLogs proxy
- All `/ui-api/pipelines/[id]/metrics` — VictoriaMetrics proxy
- All `/ui-api/pipelines/[id]/revisions` + `/library-links` — Drizzle
- All `/ui-api/notifications/*` — notifier service proxy
- All `/ui-api/kafka/*` + `/ui-api/clickhouse/*` — direct introspection
- All `/ui-api/ai/*` — Anthropic SDK + Drizzle

### What's mock-only (no real routes)
- `/ui-api/library/dedup/*` — mock only
- `/ui-api/library/filter/*` — mock only
- Dashboard incident feed + activity feed — mock only

### What's missing entirely (needs to be built)
- `/pipelines/[id]/settings` — no route, no component
- `/observability` top-level — stub only
- Schema version creation UI (route exists, no UI trigger)
- Transform validate/test UI (route exists, no UI trigger)
- Folder navigation UI (table exists, not wired)

---

## Functional Gap Priority

### P0 — Blocking user flows
| Gap | Where | ETL ticket |
|---|---|---|
| Settings tab is a stub | `/pipelines/[id]/settings` | ETL-1086 |
| Observability top-level is "coming soon" | `/observability` | ETL-1086 |
| Dedup/filter configs are mock-only | `/library/dedup`, `/library/filter` | ETL-1084 |

### P1 — Missing key affordances
| Gap | Where | ETL ticket |
|---|---|---|
| Schema version creation UI | `/library/schemas/[id]` | ETL-1084 |
| Transform validate/test button | `/library/transforms/[id]` | ETL-1086 |
| Save-draft for canvas | `/canvas`, `/pipelines/[id]/canvas` | ETL-1086 |
| Dashboard incident/activity real data | `/dashboard` | ETL-1086 |

### P2 — Polish / nice-to-have
| Gap | Where | ETL ticket |
|---|---|---|
| Real-time pipeline status (SSE to list) | `/pipelines` | ETL-1086 |
| Folder navigation in Library | `/library` | ETL-1086 |
| Revision switching UI | `/pipelines/[id]/canvas` | ETL-1084 |
| Log export | `/pipelines/[id]/logs` | ETL-1086 |
| Bulk pipeline actions | `/pipelines` | ETL-1086 |
