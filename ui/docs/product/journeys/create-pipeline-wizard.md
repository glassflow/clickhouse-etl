---
type: journey
product: GlassFlow ClickHouse ETL
journey: Create Pipeline via Wizard
tier: pro
status: complete
created: 2026-05-11
updated: 2026-05-11
skill: product:journey
---

# Journey: Create Pipeline via Wizard

## User Goal

"I want to get my Kafka (or OTLP) data flowing into a ClickHouse table — with deduplication or filtering applied before it lands."

## Trigger

Any situation where the user needs a new Kafka/OTLP → ClickHouse pipeline: adopting Kafka for the first time, onboarding a new data source, or a new business requirement for a processed/filtered data stream.

## Entry Point

Dashboard or Pipelines list → clicks **Create** (sidebar button) → selects **Wizard** in the Create modal.

## Preconditions

- [ ] GlassFlow stack is running and reachable
- [ ] Kafka cluster is reachable; at least one topic exists (topic can be empty — schema can be defined manually)
- [ ] ClickHouse instance is reachable and user has valid credentials
- [ ] User has Kafka bootstrap server address and auth credentials on hand
- [ ] User has ClickHouse host, port, database, username/password on hand
- [ ] ClickHouse target table exists **OR** user has CREATE TABLE permission to create one inline

> **Library shortcut (recommended):** If the user has previously saved a Kafka or ClickHouse connection to the Library, they can select it at the connection steps instead of typing credentials from scratch. The wizard should surface saved Library connections prominently at both connection steps.

---

## Steps — Single-Topic Kafka Pipeline (Primary Path)

| # | User action | System response | Screen |
|---|-------------|-----------------|--------|
| 1 | Clicks **Create** in sidebar | Create modal opens showing three lanes: Wizard, Canvas, AI (AI shown only if configured) | Dashboard or Pipelines list |
| 2 | Selects **Wizard** | Wizard opens at Step 1; left-panel nav shows all steps with their completion state | Wizard — Step 1: Source Type |
| 3 | Selects **Kafka** as source type | Step advances; topic count selection appears | Wizard — Step 1: Source Type |
| 4 | Selects **1 topic** (default) | Step advances to Kafka connection | Wizard — Step 1: Source Type |
| 5 | Provides bootstrap servers, auth method, credentials — or picks a saved Connection from Library | — | Wizard — Step 2: Kafka Connection |
| 6 | Clicks **Test Connection** | System tests the Kafka connection; shows loading state | Wizard — Step 2: Kafka Connection |
| 7 | — | Connection confirmed; topic list loaded and displayed | Wizard — Step 2: Kafka Connection |
| 8 | Selects a topic from the list; sets offset (default: **latest**) | System advances to event preview step | Wizard — Step 3: Topic Selection |
| 9 | — | System fetches sample events from the topic; events displayed in preview panel | Wizard — Step 4: Event Preview |
| 10 | Reviews sample events; clicks **Continue** | System infers schema from sampled events; advances to schema verification | Wizard — Step 4: Event Preview |
| 11 | Reviews inferred schema; optionally removes fields, adds arbitrary fields, or adjusts types | Schema editor reflects changes in real time | Wizard — Step 5: Schema Verification |
| 12 | Clicks **Confirm Schema** | System advances to deduplication step | Wizard — Step 5: Schema Verification |
| 13 | Reviews deduplication step (default: **skip**); optionally clicks **Enable** | If skip: clicks Continue and advances. If enabled: selects dedup key field from schema, sets time window | Wizard — Step 6: Deduplication |
| 14 | Clicks **Continue** | System advances to filtering step | Wizard — Step 6: Deduplication |
| 15 | Reviews filtering step (default: **skip**); optionally clicks **Enable** | If skip: advances. If enabled: user composes filter expression via graphical composer or manual input | Wizard — Step 7: Filter |
| 16 | Clicks **Continue** | System advances to transformation step | Wizard — Step 7: Filter |
| 17 | Reviews transformation step (default: **skip**); optionally clicks **Enable** | If skip: advances. If enabled: user defines per-field transform expressions | Wizard — Step 8: Transformation |
| 18 | Clicks **Continue** | System advances to ClickHouse connection + mapping | Wizard — Step 8: Transformation |
| 19 | Provides ClickHouse host, port, database, username, password — or picks from Library | — | Wizard — Step 9: ClickHouse Connection |
| 20 | Clicks **Test Connection** | System validates; confirms connection; loads database list | Wizard — Step 9: ClickHouse Connection |
| 21 | Selects target database | System loads tables in that database | Wizard — Step 9: ClickHouse Connection |
| 22 | Selects **Use existing table** (default); chooses table from list | System fetches ClickHouse table schema; runs automatic mapping suggestion | Wizard — Step 9: ClickHouse Mapping |
| 23 | Reviews auto-suggested field mapping; adjusts, removes, or overrides mappings | Mapping UI updates in real time; validation errors shown inline | Wizard — Step 9: ClickHouse Mapping |
| 24 | Clicks **Confirm Mapping** | System advances to resource configuration | Wizard — Step 9: ClickHouse Mapping |
| 25 | Reviews resource defaults (CPU/memory); adjusts if needed | — | Wizard — Step 10: Resources |
| 26 | Clicks **Deploy Pipeline** | System generates pipeline config; POSTs to Go backend API; shows deploying screen with status | Wizard — Step 10: Resources → Deploying screen |
| 27 | Waits | System polls deployment status; shows pipeline name + "Deploying…" state | Deploying screen |
| 28 | — | Backend confirms pipeline is active; system navigates to Pipeline details page | Pipeline detail — Overview tab |
| 29 | Sees pipeline in active state; reviews configuration summary | **[Gap: no explicit success moment — no confirmation screen or data-flow confirmation]** | Pipeline detail — Overview tab |

---

## Steps — Two-Topic Kafka Pipeline (Join variant)

Steps 1–12 above run for **Topic 1**. Then:

| # | User action | System response | Screen |
|---|-------------|-----------------|--------|
| 12b | Prompted for Topic 2 details | System shows second Kafka connection form | Wizard — Step 2b: Topic 2 Connection |
| 13b–16b | Repeats connection → topic selection → event preview → schema verification for Topic 2 | Same flow as steps 5–12 | Steps 2b–5b |
| 17b | Defines **Join configuration** — selects join key field(s) from Topic 1 schema and matching field(s) from Topic 2 schema | System validates join key compatibility | Wizard — Join Configuration |
| 18b | Clicks **Confirm Join** | System advances to deduplication (continues as single-topic path from Step 13) | — |

---

## Steps — OTLP Pipeline (OTLP variant)

| # | User action | System response | Screen |
|---|-------------|-----------------|--------|
| 1–3 | Same as Kafka steps 1–3; user selects **OTLP** as source type | Wizard skips Kafka connection, topic selection, event preview, and schema verification steps | Wizard — Step 1: Source Type |
| 4 | User proceeds directly to deduplication step | Less flexibility than Kafka path — schema is fixed by OTLP protocol | Wizard — Step 6: Deduplication |
| 5–end | Continues identically from Step 13 (dedup → filter → transform → ClickHouse mapping → resources → deploy) | — | — |

---

## Required Decisions

- **Source type:** Kafka or OTLP. **No default** — user must choose deliberately.
- **Topic count** (Kafka only): 1 topic or 2 topics (join). **Default: 1.**
- **Topic offset** (Kafka only): consume from earliest or latest event. **Default: latest.**
- **Deduplication:** enable or skip. **Default: skip.** *(Current implementation has this on by default — should be changed to skip.)*
- **Filter:** enable or skip. **Default: skip.** *(Current implementation has filters on by default — should be changed to skip.)*
- **Transformation:** enable or skip. **Default: skip.** *(Current implementation has transforms on by default — should be changed to skip.)*
- **ClickHouse table:** use existing or create new. **Default: use existing.** *(Current implementation defaults to create new — should be changed.)*
- **Schema confirmation:** always explicit — user must confirm or modify before proceeding. No auto-advance.

---

## Failure States

| Step | Failure | What user sees today | How user recovers | Gap |
|------|---------|---------------------|-------------------|-----|
| 6 — Kafka connection test | Invalid credentials, unreachable host, or TLS mismatch | Error message in notification box at bottom of screen (raw Kafka error) | Fix credentials and retry | Error messages need enrichment with actionable guidance, not just raw Kafka errors |
| 9 — Topic selection | Topic selected is empty (no messages) | App shows "No events" state in preview panel | User manually pastes/types a JSON event into the editor to define schema | Well-handled; could be clearer with an explicit prompt to "Define schema manually" |
| 11 — Schema verification | Inferred schema has wrong types or missing fields | User edits schema directly | User adjusts; no system failure | Handled — user always has final say |
| 20 — ClickHouse connection test | Bad credentials or unreachable host | Error message in notification box | Fix credentials and retry | Same enrichment gap as Kafka connection error |
| 21–22 — Table selection | User selects "Use existing" but table doesn't exist or was deleted | "Table not found" error | User switches to "Create new table" branch or selects a different table | Needs a clear inline resolution prompt |
| 22b — Create new table | Table creation fails (permission denied, invalid name) | API error message | User checks ClickHouse permissions; tries different name | Missing: clear permission requirements shown before creation attempt |
| 23 — Schema mapping | Auto-mapping has unresolvable type conflicts or missing required columns | Validation errors shown inline on mapping rows | User resolves each conflict manually | Inline validation exists; but complex mismatches need better explanation |
| 26–27 — Deployment | Backend returns deployment error | Raw API error message | No recovery path beyond retrying | **Critical gap:** no diagnostic path; user cannot tell why deployment failed; requires observability investment |
| Any step — abandoned | User closes tab or navigates away | **All work is lost; must start from scratch** | Restart the entire wizard | **Critical gap:** draft persistence is required; this is the highest-priority UX fix in the creation flow |

---

## Completion State

**Current (inadequate):**
User is redirected to the Pipeline details page with the pipeline in `starting` → `active` state. No explicit confirmation screen. No data-flow verification. The page shows a configuration summary but no signal that data is actually moving.

**Target (required):**
After deploy confirms active:
1. An explicit **"Pipeline deployed successfully"** moment — either a dedicated confirmation step or a prominent in-page banner on the Pipeline detail.
2. An immediate **data-flow indicator** — e.g., "Receiving events from Kafka" / "Writing to ClickHouse" — visible within 30 seconds of the pipeline going active.
3. A clear **"What now?"** prompt directing the user to Observability (metrics + logs) to verify the pipeline is healthy.

---

## Follow-Up Actions

After landing on the Pipeline details page, users immediately want to:

1. **Verify data is flowing** — confirm Kafka → ClickHouse transfer is active. Currently inadequate (ClickHouse metrics are aggregated across all pipelines, not pipeline-specific; DLQ metrics are basic indicators only).
2. **Check logs** — see real-time events being processed to confirm the pipeline is working as expected.
3. **Share or document** the pipeline — copy the configuration or pipeline URL for teammates.
4. **Save connections to Library** — if they typed Kafka/ClickHouse credentials manually during the wizard, they may want to save them for reuse in the next pipeline.

> **Unmapped journey flagged:** "Monitor pipeline post-deployment" (verify data flow, check metrics, respond to early errors) is the most critical follow-up journey and is currently the weakest part of the product. This should be the next journey mapped.

---

## Design Change Notes

The following current behaviors should be changed before this journey is considered complete:

| Item | Current behavior | Required behavior |
|------|-----------------|-------------------|
| Deduplication default | Enabled (opt-out) | Skipped (opt-in) |
| Filter default | Enabled (opt-out) | Skipped (opt-in) |
| Transformation default | Enabled (opt-out) | Skipped (opt-in) |
| ClickHouse table default | Create new | Use existing |
| Wizard draft persistence | None — work lost on navigate-away | Draft saved continuously; resumable from Pipelines list |
| Post-deploy completion state | Silent redirect to Pipeline details | Explicit success moment + data-flow confirmation |
| Deployment error handling | Raw API error, no path forward | Error with observability link for diagnosis |
| Library connections at connection steps | Not surfaced | Saved Library connections shown as "Use saved" option |

---

*Updated 2026-05-11 via product:journey*
