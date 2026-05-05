# Handoff: GlassFlow Web App Redesign

## 1. Overview

GlassFlow is a self-hosted, Kubernetes-deployed streaming-data product (Kafka → transform → ClickHouse, with deduplication, schemas, and a DLQ). This handoff covers a **complete redesign of its web UI**, organized around five product surfaces:

1. **Library** — Reusable resources: connections (Kafka brokers, ClickHouse clusters), schemas, and saved transforms. Replaces today's per-pipeline-cloned config with versioned, shared assets.
2. **Canvas** — Visual pipeline editor: drag-and-drop graph of source → transform → sink, with config in side panels. Replaces today's wizard-style step-by-step pipeline creation.
3. **AI Assistant** — Conversational pipeline authoring. Generates a complete pipeline draft from natural language, then drops the user into Canvas to refine. Per-pipeline scoped chats.
4. **Library ↔ Canvas Bridge** — The pinned-vs-live model that keeps Library a source of truth without breaking running pipelines: connections are live (always current), schemas/configs are pinned at deploy and explicitly upgraded.
5. **Observability** — Per-pipeline metrics (M3) and logs (M4), powered by a bundled VictoriaMetrics + VictoriaLogs stack fed by an OTEL collector that fans out to both internal and external (BYO) backends.

Plus a sixth meta-document:

6. **Overview** — Sitemap, module map, cross-module wiring, and end-to-end journeys (J1–J5). Read this first to understand how the five surfaces connect.

## 2. About the Design Files

The files in `design_files/` are **design references built in HTML/React/JSX** — high-fidelity prototypes that demonstrate the intended look, structure, and behavior. **They are not production code.** Your job is to **recreate these designs in the GlassFlow web app's existing codebase**, using its established framework, component library, routing, and state-management patterns.

If GlassFlow's existing web UI is React (most likely), reuse its component primitives (Button, Tabs, Modal, etc.) and only port the *structure*, *layout*, *content*, and *behavior* from these references. If you find yourself copying styles wholesale, stop — translate them into the codebase's design tokens / Tailwind / CSS-in-JS / styled-components convention instead.

If the codebase has no UI yet (greenfield), you may take more from the references directly, but still pick a real framework rather than running JSX through Babel-in-browser like the prototypes do.

## 3. Fidelity

**High-fidelity (hifi).** Every design has final colors, typography, spacing, copy, and interaction states. Charts, log lines, schema diffs, and graph nodes are pixel-accurate. Treat these as the visual source of truth — match spacing, type ramp, and color exactly.

A few exceptions:
- Iconography uses an inline SVG icon set (`shell.jsx`). Replace with the codebase's existing icon library (Lucide, Heroicons, etc.) where possible — match shape and weight.
- Chart values are **deterministically generated synthetic data** for the demo. Real data comes from VictoriaMetrics PromQL queries (see Section 11).
- Log lines are hand-authored examples. Real logs come from VictoriaLogs LogsQL.

## 4. How to Read the Design Files

Open each `*.html` in a static server (no build step) — they bootstrap React + Babel from CDN and render a `<DesignCanvas>` with multiple `<DCArtboard>` children. Each artboard is one screen / state.

```
open design_files/Overview Design.html      ← read this first
open design_files/Library Design.html
open design_files/Canvas Design.html
open design_files/AI Design.html
open design_files/Bridge Design.html
open design_files/Observability Design.html
```

The pan/zoom canvas lets you see all states of a feature side-by-side. **Click any artboard label to focus it fullscreen.**

## 5. Suggested Implementation Phases

Build in roughly this order — earlier phases unblock later ones.

### Phase 0 · Foundations (1–2 days)
- Set up the **design tokens** (Section 9) as CSS variables / Tailwind theme / theme provider.
- Build / wire **shared primitives**: Button (primary, secondary, ghost, sm/md), Tabs, Modal, Drawer, Tooltip, Pill/Chip, Crumbs, Toast, EmptyState, KbdHint.
- Build / wire **layout primitives**: AppShell with left nav (`Pipelines`, `Library`, `Workspace`, `Account`), top breadcrumbs, right-side panel slot.
- Pick a chart library (Recharts, Visx, or hand-rolled SVG — the prototypes use hand-rolled SVG, see `observability-primitives.jsx`). VictoriaMetrics returns Prometheus-style time series; any of these works.

### Phase 1 · Library (3–5 days)
References: `Library Design.html`, `components/artboards1.jsx`, `components/artboards2.jsx`, `styles/base.css`, `styles/theme.css`.

- **Resource list** views for Connections, Schemas, Transforms (3 sub-tabs).
- **Resource detail** with version history, "used by" pipeline list, and edit modal.
- **Schema versioning UI**: timeline of versions, inline diff between two versions, semver-bump prompt.
- **Connection edit blast-radius dialog**: "this connection is used by N pipelines — they will all see this change immediately."

### Phase 2 · Canvas (5–7 days)
References: `Canvas Design.html`, `components/canvas-primitives.jsx`, `canvas-artboards1.jsx`, `canvas-artboards2.jsx`, `styles/canvas.css`, `styles/pipeline-canvas.css`.

- **Graph editor**: nodes (source / transform / sink), edges, drag from a left palette, click-to-select, right-side config panel.
- **Validation** runs on every change: missing required fields, type mismatches, unconnected outputs. Errors render as inline node badges and a footer summary.
- **Deploy bar** (footer): Validate · Deploy · environment switcher · revision indicator.
- **Library reference chips** on nodes when a connection/schema/transform is referenced from Library. Click → drawer with the live Library record.

### Phase 3 · Bridge / pinned-vs-live model (3–4 days)
References: `Bridge Design.html`, `components/bridge-primitives.jsx`, `bridge-artboards1.jsx`, `bridge-artboards2.jsx`, `styles/bridge.css`.

- **Pipeline detail · Library links tab**: list of every Library resource the pipeline references, current pinned version, latest available, drift indicator.
- **In-canvas drift banner**: "Schema X has v5; this pipeline is pinned to v4."
- **Per-pipeline upgrade modal**: shows diff, downstream impact, "deploy revision N+1."
- **Bulk rollout** (from a Library schema's detail page): pick which pipelines to upgrade, staged or atomic, with confirm.

This is the trickiest model — it's the contract that lets Library exist without breaking prod pipelines on every edit. Read **Section 8** carefully before building.

### Phase 4 · AI Assistant (4–6 days)
References: `AI Design.html`, `components/ai-primitives.jsx`, `ai-artboards1.jsx`, `styles/ai-assistant.css`.

- **Right-side chat drawer**, scoped to a pipeline (one conversation per pipeline) and one global "new pipeline" chat.
- **Streaming responses** with structured tool-call blocks: `pipeline.draft`, `library.search`, `validate`. Each renders inline as a card with affordances ("Open in canvas", "Use this schema", etc.).
- **Drag-from-Library** into the chat as a reference (`@OrderEvents.v4`).
- **Model picker** + **token usage** indicator in the drawer header.
- The chat must call the codebase's existing AI gateway (likely `claude-haiku-4-5` or whatever the team has wired). Streaming + tool calls are required; sketch them out before committing.

### Phase 5 · Observability — Metrics (M3) (3–4 days)
References: `Observability Design.html` (artboards O1–O3), `components/observability-primitives.jsx`, `observability-artboards1.jsx`, `styles/observability.css`.

- **Metrics tab on Pipeline Detail**: time-range selector (15m/1h/6h/24h/7d/custom), three hero summary cards, six chart cards.
- **Pipeline-scoped queries**: every PromQL query must include `{pipeline_id="…"}` — the "scoped" badge in the toolbar is the visible affordance for this contract. **Never** query without `pipeline_id`; that's the bug that killed the previous ClickHouse-system-tables observability path.
- **Drill-down** view: full-width chart with component split (ingestor / processor / sink), crosshair, **brushed range** that pins across all panels and the Logs tab.
- **States**: loading skeleton (same chart frame), no-data-yet, retention-edge, per-query 503. Layout must not flicker between states.

### Phase 6 · Observability — Logs (M4) (3–4 days)
References: `Observability Design.html` (artboards O4–O6), `observability-artboards2.jsx`.

- **Logs tab**: live tail (SSE from VictoriaLogs), LogsQL search, component + severity filters with counts, structured-record drawer on click.
- **Range correlation**: a brush from Metrics or a click on the mini metrics strip filters logs to that window.
- **Context expansion**: collapsed gaps between matches, "show 5 before / 5 after" inline.
- **Drawer**: structured fields verbatim + cross-cutting links (schema, trace, DLQ).

### Phase 7 · Observability — Stack & admin (1–2 days)
References: `Observability Design.html` (artboards O7–O8).

- **Disabled / BYO state** when `internalObservability.enabled = false`. Keep the layout shape; show a respectful pointer to the helm flag with a code snippet.
- **Settings → Observability**: vmsingle/VictoriaLogs versions, retention bars, OTEL collector fan-out diagram, cardinality guard table.

### Phase 8 · Polish & glue
- **Cross-module navigation**: every "Open in canvas", "Open root cause in Library", "Jump to Logs · pre-filtered" CTA in the references should route correctly. See `Overview Design.html` artboard 3 (cross-module wiring) for the full set.
- **Responsive review** at 1280, 1440, 1920. Designs are 1680px wide; below 1280 most surfaces collapse the right side panel.
- **Empty states** on every module that can be empty (no pipelines, no connections, no schemas, no logs in window). The references include these — don't ship without them.

## 6. Module-by-Module Reference

### 6.1 Library
- **File:** `design_files/Library Design.html`
- **Components:** `components/artboards1.jsx`, `components/artboards2.jsx`
- **Styles:** `styles/base.css`, `styles/theme.css`
- **Sections:**
  - Connections list, detail, edit
  - Schemas list, detail (timeline + diff), edit, semver bump
  - Transforms list, detail, edit
  - "Used by" inverse-references on every resource
- **Key contracts:**
  - Schemas are versioned (semver). New version is opt-in for downstream pipelines.
  - Connections are not versioned — edit is live, blast-radius dialog warns.
  - Transforms are versioned.

### 6.2 Canvas
- **File:** `design_files/Canvas Design.html`
- **Components:** `components/canvas-primitives.jsx`, `canvas-artboards1.jsx`, `canvas-artboards2.jsx`
- **Styles:** `styles/canvas.css`, `styles/pipeline-canvas.css`
- **Sections:**
  - Empty canvas (new pipeline)
  - Populated canvas (deploy-ready)
  - Validation error states
  - Side panel: source config, transform config, sink config
  - Library reference chips on nodes
  - Deploy bar
- **Key contracts:**
  - A node referencing a Library resource shows the resource's pinned version and a drift badge if a newer one exists.
  - Validate is run on every change; deploy is gated on no errors.

### 6.3 AI Assistant
- **File:** `design_files/AI Design.html`
- **Components:** `components/ai-primitives.jsx`, `ai-artboards1.jsx`
- **Styles:** `styles/ai-assistant.css`
- **Sections:**
  - Drawer collapsed / expanded
  - First-prompt empty state with suggestion chips
  - Streaming response with tool-call cards (`pipeline.draft`, `library.search`)
  - "Apply to canvas" handoff
  - Per-pipeline scoped chat (one chat per pipeline; "Resume chat" CTA on Pipeline Detail)
- **Key contracts:**
  - The assistant must read from Library when generating drafts (uses connections / schemas the user already has).
  - Generated pipelines are drafts in Canvas, not auto-deployed.

### 6.4 Library ↔ Canvas Bridge (the pinned-vs-live model)
- **File:** `design_files/Bridge Design.html`
- **Components:** `components/bridge-primitives.jsx`, `bridge-artboards1.jsx`, `bridge-artboards2.jsx`
- **Styles:** `styles/bridge.css`
- **The model in one paragraph:**
  - **Connections** = live. Editing the prod ClickHouse hostname in Library immediately changes the host every pipeline talks to. The blast-radius dialog forces the user to acknowledge this.
  - **Schemas** = pinned. A pipeline references `OrderEvents.v4`. When the schema owner publishes v5, every pipeline keeps running on v4 until its owner explicitly upgrades. Drift is surfaced in three places: pipeline detail, in-canvas, and on the schema's "used by" list in Library.
  - **Transforms** = pinned, same model as schemas.
- **Why this matters:** the previous "everything is live" model meant a schema author could break ten pipelines with one edit. The previous "everything is cloned" model meant Library was useless because edits never propagated. Pinned-vs-live is the compromise that makes Library a source of truth *and* keeps prod stable.

### 6.5 Observability
- **File:** `design_files/Observability Design.html`
- **Components:** `components/observability-primitives.jsx`, `observability-artboards1.jsx`, `observability-artboards2.jsx`
- **Styles:** `styles/observability.css`
- **8 artboards:**
  - **O1** — Metrics dashboard (populated)
  - **O2** — Metric drill-down with brushed range
  - **O3** — Loading / no-data / retention-edge / query-error states
  - **O4** — Logs live tail
  - **O5** — Logs search + context expansion + range correlation
  - **O6** — Log line inspector drawer
  - **O7** — Disabled / BYO state
  - **O8** — Settings → Observability stack panel
- **Stack:** bundled single-node VictoriaMetrics (vmsingle, 7d retention default) + VictoriaLogs (3d retention default), fed by an OTEL collector that fans out to both internal stack and the user's existing backend.
- **Key contract:** every metric query is `pipeline_id`-scoped at the API layer. There must be no UI affordance to query across pipelines in v1.

### 6.6 Overview / Sitemap
- **File:** `design_files/Overview Design.html`
- **Components:** `components/overview-artboards.jsx`
- **Styles:** `styles/overview.css`
- **Read first.** Five artboards covering sitemap, modules, cross-module wiring, journeys J1–J5 (first pipeline via AI; schema rollout; Kafka creds rotation; DLQ debug; teammate invite), and out-of-scope sketches with open questions.

## 7. Information Architecture

```
Top-level nav (left rail)
├── Pipelines/
│   ├── List
│   └── /:id/  (Pipeline Detail tabs)
│        ├── Overview
│        ├── Canvas        ← Phase 2
│        ├── Library links ← Phase 3
│        ├── Metrics       ← Phase 5
│        ├── Logs          ← Phase 6
│        └── Settings
├── Library/                ← Phase 1
│   ├── Connections
│   ├── Schemas
│   └── Transforms
├── Workspace/
│   ├── Settings
│   ├── Members
│   ├── Environments
│   └── Observability      ← Phase 7 (admin surface)
└── Account/
    ├── Profile
    └── API keys

Right-side AI drawer        ← Phase 4 (overlay across all surfaces)
```

## 8. Critical Cross-Module Contracts

These are the contracts that make the redesign cohere. Get them wrong and the whole thing falls apart.

### 8.1 Pinned-vs-live (Bridge)
- Connection edits are live for all pipelines, including running ones. Always show blast radius before save.
- Schema and transform versions are pinned per pipeline. Pipeline detail and canvas must show pinned version; Library must show "used by" with pinned versions.
- An upgrade is a pipeline revision (new deploy). Never an in-place mutation.

### 8.2 Pipeline-scoped observability
- Every metrics or logs query must carry `pipeline_id`. The "scoped: <id>" badge in the toolbar is the visible affordance.
- No cluster-wide views in v1. (See Overview's out-of-scope artboard for the open question on adding them later.)

### 8.3 AI per-pipeline chat
- Each pipeline has exactly one persistent assistant chat. Plus one global "new pipeline" chat.
- The drawer header shows which pipeline the chat is scoped to. Switching pipelines switches chats.
- "Resume chat" CTA on Pipeline Detail returns the user to the existing transcript.

### 8.4 Brushed range pin
- A range selected on any chart in Metrics is a global filter. It shrinks all other panels on the page and pre-filters the Logs tab when navigated to. A pill at the top right reads "pinned: 13:00 – 13:08 · from Metrics drill-down ×".

### 8.5 OTEL collector fan-out (observability)
- The internal VM/VL stack does not replace the user's existing Grafana/Datadog/etc. — the collector fans out to both. Enabling the internal stack is purely additive.

## 9. Design Tokens

These come from `styles/theme.css` and `styles/base.css`. Translate them to your codebase's token system.

### Colors (dark theme — primary)
```
--color-background:           #050507
--color-background-elevated:  #08080a
--color-surface:              #0c0c10
--color-surface-elevated:     #0e0e12
--color-foreground-neutral:   #e1e1e6   (primary text)

Grays
--color-gray-100:             #ebebef
--color-gray-250:             #c7c7cc
--color-gray-350:             #98989d
--color-gray-dark-100:        #b4b4b8
--color-gray-dark-500:        #5a5a64
--color-gray-dark-700:        #2c2c34
--color-gray-dark-800:        #15151b

Accent (orange — primary brand)
--color-orange-200:           #f7c8a0
--color-orange-300:           #e89159   (primary accent — buttons, focus, brand)
--color-orange-alpha-10:      rgba(232, 145, 89, 0.10)
--color-orange-alpha-20:      rgba(232, 145, 89, 0.20)

Semantic
--color-blue-500:             rgb(101, 165, 245)   (info, ingestor)
--color-green-500:            rgb(102, 198, 132)   (success, sink, "live")
--color-yellow-400:           rgb(232, 197, 89)    (warn, drift)
--color-red-500:              rgb(238, 95, 95)     (error, DLQ, destructive)
```

### Typography
```
--font-family-title:  'IBM Plex Sans', system-ui, sans-serif    (page titles, card titles)
--font-family-body:   'IBM Plex Sans', system-ui, sans-serif    (body)
--font-family-mono:   'JetBrains Mono', ui-monospace            (chart values, IDs, timestamps, code)

Scale (px)
9.5  10  10.5  11  11.5  12  12.5  13  14  16  18  19  21
```
Mono is used heavily for IDs, timestamps, query strings, axis labels, and structured-field tables — that visual rhythm is part of the brand. Don't substitute mono for body in those places.

### Spacing
4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 28 · 36 · 40px (most common)

### Radii
4 · 6 · 8 · 10 · 12 · 999 (pill)

### Shadows
- Tooltip / drawer: `0 6px 18px rgba(0,0,0,0.45)`

### Borders
- Default: `1px solid var(--color-gray-dark-800)` (`#15151b`)
- Hover/active: `1px solid var(--color-gray-dark-700)` (`#2c2c34`)
- Brand-tinted: `color-mix(in srgb, var(--color-orange-300) 35%, var(--color-gray-dark-800))`

## 10. Components Inventory (build / wire these)

| Component | Used in | Notes |
|---|---|---|
| Button (primary, secondary, ghost, sm/md) | every | exists in shell.jsx as `.btn .btn-primary` etc. |
| Tabs (with badge slot) | Pipeline Detail | `OBTabs` in observability-primitives.jsx |
| Modal | upgrade flows, blast radius | bridge artboards |
| Drawer (right) | log inspector, AI chat | observability + AI artboards |
| Crumbs | every detail page | `.br-crumbs` in bridge.css |
| Pill / Chip (with swatch) | filter rows | `OBPill` |
| Time-range segmented control | metrics + logs | `OBRangePicker` |
| Live indicator (pulsing dot) | logs live tail | `OBLive` |
| Scope trust badge | metrics + logs toolbars | `OBScopeBadge` |
| Chart card (title, current value, delta, sparkline-or-line) | metrics dashboard | `OBChart` + `OBChartSVG` |
| Sparkline | summary cards | `OBSpark` |
| Log line | logs viewer | `OBLogLine` |
| Empty state (with CTA + code snippet) | disabled obs, empty list views | `.ob-empty` pattern |
| Skeleton shimmer | loading states | `.ob-skel` keyframes |
| Pipeline header (status dot + name + env chip + revision) | every pipeline-scoped page | `OBPipelineHeader` |
| Graph node + edge | Canvas | `canvas-primitives.jsx` |
| Schema diff viewer | Library, Bridge upgrade | `bridge-primitives.jsx` |
| Resource "used by" list | Library | `artboards2.jsx` |
| AI tool-call card | AI drawer | `ai-primitives.jsx` |

## 11. Backend Wiring (what this UI expects)

These are the API shapes the UI was designed around. Your codebase may already have most of these — match.

### Library
- `GET /api/v1/library/connections` → list
- `GET /api/v1/library/connections/:id` → detail with `usedBy: PipelineRef[]`
- `PATCH /api/v1/library/connections/:id` → live update; response includes `affectedPipelines: number`
- `GET /api/v1/library/schemas` → list
- `GET /api/v1/library/schemas/:id` → detail with `versions: SchemaVersion[]`, `usedBy: { pipelineId, pinnedVersion }[]`
- `POST /api/v1/library/schemas/:id/versions` → publish new version (semver bump)
- Same shape for `transforms`.

### Pipelines
- `GET /api/v1/pipelines/:id` → includes `revision`, `status`, `references: { connections: [], schemas: [{id, pinnedVersion}], transforms: [{id, pinnedVersion}] }`
- `POST /api/v1/pipelines/:id/revisions` → new deploy (also used for upgrade flow with delta references)
- `GET /api/v1/pipelines/:id/library-links` → drift-aware view (pinned vs latest per reference)

### Observability
- `GET /api/v1/pipelines/:id/metrics?query=<promql>&from=&to=&step=` → proxies to vmsingle, **server-side enforces `{pipeline_id="<id>"}` label match.** Every standard chart has a known query name (e.g. `records_ingested`, `latency_p99`, `dlq_rate`).
- `GET /api/v1/pipelines/:id/logs?query=<logsql>&from=&to=&limit=` → VictoriaLogs query; same scope enforcement.
- `GET /api/v1/pipelines/:id/logs/stream` (SSE) → live tail, with `?severity=` and `?component=` filters.
- `GET /api/v1/observability/stack` → admin view: vmsingle/VictoriaLogs versions, retention, disk usage, cardinality, fan-out config.

### AI
- `POST /api/v1/ai/chat` → streaming. Request has `pipelineId?` (or null for global new-pipeline chat) and `messages[]`. Response is a stream of `text` chunks and `tool_call` blocks (`pipeline.draft`, `library.search`, `validate`).
- `GET /api/v1/ai/chats/:pipelineId` → load existing transcript.

## 12. Files in this Bundle

```
design_files/
├── Overview Design.html       ← read first
├── Library Design.html
├── Canvas Design.html
├── AI Design.html
├── Bridge Design.html
├── Observability Design.html
├── design-canvas.jsx          (the panel layout primitive — for reference only)
│
├── styles/
│   ├── base.css               primitives — buttons, chips, layout helpers
│   ├── theme.css              tokens (translate to your design system)
│   ├── canvas.css             pipeline graph editor
│   ├── pipeline-canvas.css    canvas internals
│   ├── bridge.css             pipeline detail / drift / upgrade
│   ├── ai-assistant.css       AI chat drawer
│   ├── observability.css      metrics + logs (this is the newest one)
│   └── overview.css           sitemap meta-doc
│
└── components/
    ├── shell.jsx              shared Icon set + AppShell + .btn primitives
    ├── canvas-primitives.jsx  graph node, edge, palette, validation badges
    ├── canvas-artboards1.jsx  Canvas screens
    ├── canvas-artboards2.jsx
    ├── artboards1.jsx         Library — connections + schemas
    ├── artboards2.jsx         Library — transforms + used-by
    ├── ai-primitives.jsx      AI chat bubbles, tool-call cards
    ├── ai-artboards1.jsx      AI screens
    ├── bridge-primitives.jsx  schema diff, drift badge, upgrade modal
    ├── bridge-artboards1.jsx  Bridge screens
    ├── bridge-artboards2.jsx
    ├── observability-primitives.jsx   chart, sparkline, log line, time range, live, scope
    ├── observability-artboards1.jsx   O1, O2, O3
    ├── observability-artboards2.jsx   O4, O5, O6, O7, O8
    └── overview-artboards.jsx sitemap, modules, wiring, journeys
```

## 13. Open Questions / Decisions to Confirm

These were flagged in the Overview's "out of scope" artboard; if any of them have been resolved since this handoff, update Section 5 accordingly.

1. **Cluster-wide observability**: in v1, every chart is per-pipeline. A cluster-wide overview is out of scope. Confirm before building any "all pipelines" rollups.
2. **Tracing**: OTEL collector emits trace spans, but no UI in v1. Trace IDs in log lines are clickable → reserved for v2. For now, link them to a placeholder or to the user's external APM if configured.
3. **Billing / usage units**: pipeline-hours? events? GB? Stub Account → Billing for now.
4. **Audit log**: model exists in Overview but not designed. Stub it.
5. **DLQ replay**: button is in artboards but the actual replay flow isn't fleshed out. Wire to a "coming soon" modal if backend isn't ready.
6. **Multi-tenancy**: schema labels reserve `tenant_id` but it's not used in v1. Keep the room.

## 14. Definition of Done (per phase)

See `ACCEPTANCE_CRITERIA.md` for the explicit per-phase checklist. Use it as a gate, not a guideline — if a criterion fails, the phase is not done.



A phase is done when:
- Every artboard's screen / state is reachable in the running app via real navigation, with real data shapes (mocked or real).
- Empty / loading / error states match the references — not just the happy path.
- Cross-module CTAs (Section 8) navigate correctly.
- Designs match the references at 1680px wide. Below 1280, gracefully collapse.
- Component primitives from your design system are reused where possible. Only the structure / content / behavior is copied from the references; styling comes from your tokens.

---

If anything in this README contradicts the design files, **the design files win** — flag the contradiction and ask. If anything in the design files contradicts the GlassFlow product team's spec docs (M3 / M4 etc.), **the spec wins** — flag and ask.
