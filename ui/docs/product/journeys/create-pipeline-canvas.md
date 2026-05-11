---
type: journey
product: GlassFlow ClickHouse ETL
journey: Create Pipeline via Canvas
tier: pro
status: complete
created: 2026-05-11
updated: 2026-05-11
skill: product:journey
---

# Journey: Create Pipeline via Canvas

## User Goal

"I want to visually assemble a pipeline from components I already have — and see the whole picture at once before I deploy."

Same end result as the Wizard: a deployed Kafka/OTLP → ClickHouse pipeline. Different approach: visual, non-linear, Library-first, better for complex pipelines.

## Trigger

- Power user who knows what they want to build and prefers a visual overview
- User with existing Library components (saved Connections, Schemas) ready to reuse
- User building a complex pipeline (two-topic join, multiple processing steps) who benefits from seeing all nodes simultaneously
- User who started a Draft in the Wizard and wants to switch to Canvas for a visual review

## Entry Point

Sidebar **Create** button → Create modal → selects **Canvas**.

## Preconditions

Canvas has **softer preconditions than the Wizard**:

- [ ] GlassFlow stack is running
- [ ] A Draft can be started and saved even without valid/tested connections — the canvas is intentionally non-linear
- [ ] Working Kafka connection is needed to derive schema from a live topic — but schema can be defined manually, so this is not a hard gate
- [ ] Working ClickHouse connection is required to map to an existing table — but a new table can be created, and an untested connection can be saved to Draft
- [ ] **Deploying** a pipeline with an untested/broken connection will fail at runtime — the canvas surfaces this as a validation warning, not a hard block during construction

> **Library shortcut:** If the user has saved Connections, Schemas, or other artifacts in the Library, those are available in the left panel and can be dropped onto the canvas directly. The canvas is most powerful when the Library is populated.

---

## Steps — Primary Path (Library-first, single-topic Kafka)

| # | User action | System response | Screen |
|---|-------------|-----------------|--------|
| 1 | Clicks **Create** in sidebar | Create modal opens: Wizard / Canvas / AI | Dashboard or Pipelines list |
| 2 | Selects **Canvas** | Canvas opens; system presents two starting options | Canvas |
| 3 | Chooses **Start from template** | System asks: source type (Kafka 1-topic / Kafka 2-topic / OTLP) | Canvas — template picker |
| 4 | Selects pipeline type (e.g., Kafka single-topic) | System pre-populates canvas with the correct node skeleton: `[KafkaSource] → [Dedup?] → [Filter?] → [Transform?] → [ClickHouseSink]`. Optional nodes (Dedup, Filter, Transform) rendered greyed-out/inactive | Canvas |
| 5 | Clicks the **KafkaSource** node | Right-side config drawer opens for this node | Canvas + node drawer |
| 6 | In drawer: picks a saved Kafka Connection from Library OR types connection details manually; clicks **Test Connection** | System validates; shows success or error inline in drawer | Node drawer — KafkaSource |
| 7 | Selects topic from loaded list; sets offset (default: **latest**) | Node drawer updates; KafkaSource node shows topic name | Node drawer — KafkaSource |
| 8 | Optionally clicks **Fetch schema from topic** | System fetches sample events; infers schema; schema appears in drawer for review/edit | Node drawer — KafkaSource |
| 9 | Confirms or edits schema; closes drawer | KafkaSource node marked complete (visual indicator — e.g., green checkmark) | Canvas |
| 10 | Optionally nudged: "Save this connection to Library?" | If user accepts: connection is saved to Library with a name | Canvas — save-to-Library prompt |
| 11 | Clicks **Dedup** node (greyed-out) | Node activates; right drawer opens for dedup config | Canvas + node drawer |
| 12 | Opts in to deduplication: selects key field from schema; sets time window | Node turns active (solid); dedup config saved to node | Node drawer — Dedup |
| 13 | OR: leaves Dedup greyed-out and skips (node stays inactive) | Node remains greyed-out; not included in pipeline config | Canvas |
| 14 | Clicks **Filter** node; configures or skips | Same pattern as Dedup | Node drawer — Filter |
| 15 | Clicks **Transform** node; configures or skips | Same pattern as Dedup | Node drawer — Transform |
| 16 | Clicks the **ClickHouseSink** node | Right-side config drawer opens | Canvas + node drawer |
| 17 | Picks a saved ClickHouse Connection from Library OR types connection details; clicks **Test Connection** | System validates; loads database list | Node drawer — ClickHouseSink |
| 18 | Selects database and target table (default: **use existing**) | System fetches ClickHouse schema; runs automatic mapping suggestion; mapping shown in drawer | Node drawer — ClickHouseSink |
| 19 | Reviews/adjusts field mapping; closes drawer | ClickHouseSink node marked complete | Canvas |
| 20 | Reviews complete canvas — all required nodes complete | Canvas validation runs: all mandatory nodes populated; all lines connected; no red nodes | Canvas |
| 21 | Clicks **Deploy** | System validates canvas; if valid: opens **Config Preview modal** showing generated YAML/JSON | Config Preview modal |
| 22 | Reviews config; clicks **Confirm & Deploy** (formal sign-off) | Modal closes; system submits config to Go backend API; navigates to deploying screen | Deploying screen |
| 23 | Waits briefly | System polls deployment; pipeline goes `starting` → `active` | Deploying screen |
| 24 | — | System navigates to Pipeline details page | Pipeline detail — Overview |

---

## Steps — Blank Canvas Variant

| # | User action | System response |
|---|-------------|-----------------|
| 3b | Chooses **Start from blank** | Empty canvas opens with no pre-placed nodes |
| 4b | Drags node types from left panel onto canvas | Nodes appear on canvas; user positions and connects them manually |
| 5b+ | Continues from Step 5 above (configure each node) | Same node-drawer flow |

> The blank canvas is more flexible but puts more responsibility on the user to know what the mandatory pipeline structure is. Validation at deploy time still catches missing required nodes.

---

## Steps — Two-Topic Join Variant

When template is **Kafka 2-topic** or user adds a second KafkaSource node:

| # | User action | System response |
|---|-------------|-----------------|
| 5c | Canvas shows: `[KafkaSource A] ↘` `[KafkaSource B] ↗` `→ [Join] → [Dedup?] → [Filter?] → [Transform?] → [ClickHouseSink]` | Two source nodes + Join node pre-populated |
| 6c–9c | User configures KafkaSource A then KafkaSource B (same steps 5–9 for each) | Each source node gets its own topic, offset, and schema |
| 10c | User clicks **Join** node | Drawer shows fields from both schemas; user selects matching join keys from each | 
| 11c | Continues from Dedup step | Same as primary path |

---

## Required Decisions

- **Starting shape:** Template (picks pipeline type → pre-populated node layout) or Blank canvas. **Recommended default: Template** for new users; blank for advanced.
- **Source type** (template path only): Kafka 1-topic / Kafka 2-topic / OTLP. **No default — user must choose.**
- **Topic offset** (Kafka): latest or earliest. **Default: latest.**
- **Dedup / Filter / Transform nodes:** activate or leave greyed-out (skip). **Default: skip** (node stays inactive unless user deliberately activates it).
- **ClickHouse table:** use existing or create new. **Default: use existing.**
- **Save to Library (nudge):** after successful connection test, system prompts user to save the connection. User decides yes or no — not a gate.
- **Config preview sign-off:** formal confirmation before deploy. Not an edit step — editing happens on the canvas. If user wants to change something after seeing the preview, they dismiss the modal and edit the relevant node.

---

## Draft Persistence and Lane Switching

**Canvas Drafts are saved to the same Draft object as Wizard and AI journeys.** This is the key principle that enables lane switching:

- A user can start in Canvas, save a Draft at any point (even with incomplete nodes), and resume later.
- A user can start in Wizard, get partway through, and switch to Canvas to get a visual overview of what they've built so far — the partially-configured Draft is reflected in the canvas nodes.
- A user can start with AI Assistant (which produces a `PipelineIntentModel`), then switch to Canvas to visually adjust the result before deploying.
- Incomplete nodes are shown with a visual indicator (e.g., grey border, missing-data badge) so the user can see at a glance what still needs attention when resuming a Draft.

> **Current implementation gap:** Draft persistence does not exist today. Navigating away from the canvas loses all work. This is the highest-priority gap for the Canvas journey.

---

## Failure States

| Step | Failure | What user sees | How user recovers | Gap |
|------|---------|---------------|-------------------|-----|
| 6 — Connection test in drawer | Kafka or ClickHouse connection fails | Error shown inline in the node drawer; node remains in incomplete/red state | User fixes credentials and retries from the drawer | Error messages need enrichment with actionable guidance |
| 20 — Canvas validation | Incomplete node: required fields not filled | Node highlighted red; validation summary lists incomplete nodes | User clicks the red node, drawer opens for that node | Already the intended behavior — needs implementation |
| 20 — Canvas validation | Missing required node: e.g., no ClickHouseSink | Canvas validation error: "Pipeline requires a destination node" | User drags a ClickHouseSink node from left panel | Validation must know what nodes are mandatory for the selected pipeline type |
| 20 — Canvas validation | Disconnected node: node on canvas but not connected by a line | Canvas validation error highlighting the disconnected node | User draws the missing connection line | Graph structure validation must be implemented |
| 17–18 — ClickHouse config | Table doesn't exist (use existing path) | "Table not found" error in drawer | User switches to "Create new table" or selects a different table | Same as wizard |
| 21 — Deploy | Canvas valid but backend deployment fails | Raw API error after config preview | Same gap as wizard: no diagnostic path | See monitor-pipeline.md — observability investment required |
| Any step — navigates away | Work lost if Draft not saved | All canvas work lost | Must rebuild from scratch | **Critical gap:** Draft persistence is the prerequisite fix |
| 5 — Library empty | User opens Canvas expecting saved Connections, Library is empty | Left panel shows no saved items | User fills in connection details directly in the node drawer; optionally saves to Library after testing | Not a failure — but onboarding copy should explain this so users aren't confused by the empty panel |

---

## Completion State

Same as Wizard: pipeline is `active` on the Pipeline details page, data-flow metrics are visible.

The additional signal specific to Canvas: the Config Preview modal was reviewed and signed off — the user saw the full generated YAML/JSON before committing. This means the user has higher confidence in what was deployed than in the wizard path (where the config is implicit in the steps).

**Gap (same as wizard):** no explicit "data is flowing" confirmation after landing on Pipeline details. The post-deploy experience gap applies equally here.

---

## Follow-Up Actions

Identical to Wizard: user wants to confirm data is flowing, check metrics, optionally save connections to Library if they didn't during the canvas session.

No Canvas-specific post-deploy actions. The pipeline detail page does not provide a "go back to canvas" link for minor adjustments — that is accessed via the Pipeline detail → Canvas tab.

---

## Unmapped Follow-Up Journey

The bidirectional Library integration introduces a shorter but important journey: **"Save a component to Library from Canvas"** (and from Wizard). This is triggered when:
- User tests a connection in a canvas node drawer → system nudges "Save to Library?"
- User wants to reuse a schema or dedup config they configured in this session

This journey is short enough to be a feature spec rather than a full journey map. Flagged for `product:shape`.

---

*Updated 2026-05-11 via product:journey*
