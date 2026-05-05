# Acceptance Criteria · per phase

These are the gates each phase must pass before it is considered done. Use these as a checklist while implementing — if a criterion fails, the phase is not done, regardless of how much code has been written.

**Rules of engagement:**
- A criterion either passes or fails. No "mostly works."
- If you find yourself wanting to mark something done with a caveat, file the caveat as a separate issue and leave the criterion failing.
- Empty / loading / error states are first-class. A phase that ships only the happy path **is not done**.
- If a criterion conflicts with the design references, the references win — flag the contradiction and ask before deviating.
- If a criterion conflicts with GlassFlow's product spec (M3, M4, etc.), the spec wins — flag and ask.

---

## Phase 0 · Foundations

- [ ] Design tokens from `README.md` Section 9 are defined as the codebase's native token system (CSS variables / Tailwind theme / theme provider). All colors, type, spacing, radii are reachable by name.
- [ ] `--color-orange-300` (`#e89159`) is the primary brand accent, used on primary buttons, focus rings, and the live indicator.
- [ ] `JetBrains Mono` (or the codebase's mono equivalent) is wired as `font-family-mono` and used for IDs, timestamps, axis labels, and code snippets.
- [ ] Shared primitives exist and are used everywhere: `Button` (primary, secondary, ghost, sm/md), `Tabs` (with badge slot), `Modal`, `Drawer`, `Tooltip`, `Pill`, `Crumbs`, `Toast`, `EmptyState`, `KbdHint`.
- [ ] App shell renders the four-section left rail (Pipelines, Library, Workspace, Account) and a breadcrumb slot at the top.
- [ ] A chart library is chosen and wired with a smoke-test chart that hits a fake VictoriaMetrics endpoint. (Recharts, Visx, or hand-rolled SVG — any is fine; pick one and commit.)
- [ ] Dark theme is the only theme. No light mode in v1.
- [ ] Ports from prototype source code do **not** ship Babel-in-browser. JSX is compiled at build time.

## Phase 1 · Library

- [ ] `/library/connections`, `/library/schemas`, `/library/transforms` all render a list view with create / search / filter.
- [ ] Each resource type has a detail page reachable by clicking a row.
- [ ] Schema detail shows a version timeline and an inline diff between any two selected versions.
- [ ] Connection edit triggers a **blast-radius dialog** that lists every pipeline using the connection, with a checkbox "I understand this is a live change." Save is gated on the checkbox.
- [ ] Connection edits propagate live to running pipelines (no per-pipeline upgrade flow). A toast confirms.
- [ ] Schema "publish new version" runs a semver-bump prompt (major/minor/patch radio + summary text). New version becomes the latest but no pipeline is auto-upgraded.
- [ ] Every resource detail shows a "used by" list with the pinned version per pipeline (for schemas/transforms) or just the pipeline list (for connections).
- [ ] Empty list state matches the reference's `EmptyState` pattern — heading, copy, primary CTA, code-snippet hint where applicable.
- [ ] List loading shows a skeleton row pattern, not a spinner.

## Phase 2 · Canvas

- [ ] A new pipeline opens to an empty canvas with a left palette and a right config panel.
- [ ] Drag-and-drop from the palette creates a node. Click selects; drag moves; backspace deletes.
- [ ] Edges connect a source's output port to a transform/sink's input port. Type-incompatible connections are rejected with an inline message.
- [ ] Selected node opens its config in the right panel.
- [ ] Library reference chips appear on nodes that reference Library resources, showing the pinned version. Clicking a chip opens a drawer with the live Library record.
- [ ] Validation runs on every change. Errors are shown both as inline node badges and as a footer summary count.
- [ ] Footer deploy bar has: Validate (manual run), Deploy (gated on no errors), env switcher, current revision indicator.
- [ ] Deploying creates a new revision and navigates to the new pipeline detail.
- [ ] Discarding unsaved changes prompts a confirm modal.
- [ ] Validation, drift, and deploy states all render identically when no data is loading (no flicker).

## Phase 3 · Library ↔ Canvas Bridge

- [ ] **Pipeline detail · Library links tab** lists every Library resource the pipeline references, with: pinned version, latest available, drift state (none / minor / major), last upgraded date.
- [ ] When drift exists, the pipeline detail header shows a yellow drift badge with a count.
- [ ] Opening the canvas of a pipeline with drift shows an in-canvas banner: "Schema X has v5; this pipeline is pinned to v4. Upgrade…"
- [ ] **Per-pipeline upgrade modal** renders: schema diff, downstream node-level impact, and "Deploy revision N+1" button. Cancel discards.
- [ ] Upgrading creates a new revision (does not in-place mutate).
- [ ] **Bulk rollout** (from a Library schema's detail page): user picks pipelines, picks atomic-or-staged, sees a summary diff, and confirms. Each affected pipeline gets a new revision.
- [ ] Connections (live) and schemas/transforms (pinned) are visually distinct on every surface that lists them. The contract is legible without reading docs.
- [ ] Library "used by" reflects pinned versions accurately within 5 seconds of any schema/transform publish or pipeline deploy.

## Phase 4 · AI Assistant

- [ ] Right-side drawer is reachable from a global toolbar button. It expands and collapses without unmounting transcript state.
- [ ] Drawer header shows which pipeline the chat is scoped to (or "New pipeline" for the global chat). Switching pipelines switches chats.
- [ ] First-prompt empty state shows suggestion chips from the references.
- [ ] Streaming responses render incrementally (text chunks visible before the response is complete).
- [ ] Tool-call blocks (`pipeline.draft`, `library.search`, `validate`) render as cards with the affordances from the references — never as raw JSON.
- [ ] `pipeline.draft` card has an "Open in canvas" CTA that creates a draft pipeline (not deployed) and routes to its canvas.
- [ ] `library.search` card lists matching Library resources with click-to-insert into the current draft.
- [ ] Drag a Library item into the chat input inserts a structured reference (`@OrderEvents.v4`).
- [ ] Drawer header shows model name and a token usage indicator.
- [ ] Chats persist across reloads. "Resume chat" CTA on Pipeline Detail returns to the existing transcript.
- [ ] Errors (rate limit, model down) render as inline error bubbles with a retry button. They do not break the transcript.

## Phase 5 · Observability · Metrics (M3)

- [ ] Every metric query passes through an API layer that **server-side enforces** `{pipeline_id="<id>"}` on the PromQL. There is no UI affordance to remove this label. (Verify by attempting a raw query without it — it must be rejected by the server.)
- [ ] `scoped: <pipeline-id>` badge is visible in the Metrics toolbar at all times.
- [ ] Time-range segmented control supports 15m / 1h / 6h / 24h / 7d / custom. Switching ranges refetches without a layout flicker.
- [ ] Three hero summary cards (records ingested, p99 latency, DLQ rate) render with a sparkline and a delta vs the previous window.
- [ ] Six chart cards render with: title, sub-line query string, current value, delta, line chart, legend.
- [ ] Hovering a chart shows a crosshair + tooltip with all series values at that timestamp.
- [ ] Brushing a range on any chart pins it as a global filter — every other chart on the page shrinks to that window, and the Logs tab opens pre-filtered.
- [ ] Pinned range pill shows at top-right with `pinned: 13:00 – 13:08 · from Metrics drill-down` and an `×` to clear.
- [ ] **Drill-down view** (clicking a chart): full-width chart with component split (ingestor / processor / sink), legend with current values, "logs in this range" panel with component count breakdown and a CTA to jump to logs.
- [ ] **States** render in the same chart frame without layout shift: loading skeleton, no-data-yet (just-deployed), retention-edge (window extends past retention), per-query 503.
- [ ] A query failing on one card does not blank the others. Failures are scoped per query, not per page.
- [ ] Auto-refresh runs every 30s when range is "now"-anchored. Pauses when tab is hidden.

## Phase 6 · Observability · Logs (M4)

- [ ] Logs tab live-tails by default via SSE. The "live" pulse indicator is visible.
- [ ] Pause / resume stream button works without losing buffered lines.
- [ ] Log lines render as columns: timestamp · component · severity · message. Severity stripes left of the row tint by level.
- [ ] Component filter pills and severity filter pills work. Counts on each pill update with the result set.
- [ ] LogsQL search input runs queries on `Cmd+Enter`. The match count shows next to the input.
- [ ] **Context expansion** around any matched line: "show 5 before / 5 after" expands inline. Collapsed gaps between matches show "· N lines collapsed · click to expand ·".
- [ ] Clicking a line opens the **inspector drawer** with all structured fields verbatim and cross-cutting links (schema, trace, DLQ).
- [ ] Brushed range from Metrics is honored on the Logs tab — the pinned-range pill is visible and dismissable.
- [ ] Top-of-page mini metrics strip in the Logs tab correlates throughput / errors / warns to the current window.
- [ ] Same query / range / scope produces the same results on reload (URL-encodable state).
- [ ] Like Metrics, every logs query is `pipeline_id`-scoped at the server. No UI affordance bypasses this.

## Phase 7 · Observability · Stack & admin

- [ ] When `internalObservability.enabled = false`, both Metrics and Logs tabs render the disabled / BYO state — same chart frame, greyed summary cards, helm snippet, "Open in your Grafana →" CTA.
- [ ] Layout shape is preserved between disabled and enabled states (no jump when the flag is flipped).
- [ ] **Settings → Observability** page renders: vmsingle and VictoriaLogs versions, retention bars (used / total), OTEL collector fan-out diagram, cardinality guard table, M3/M4/M5 roadmap rows.
- [ ] Retention bar tone tracks usage: green < 50%, yellow 50–80%, red > 80%.
- [ ] Cardinality guard table has live numbers from `/api/v1/observability/stack`.

## Phase 8 · Polish & glue

- [ ] Every cross-module CTA from the Overview's "cross-module wiring" artboard navigates correctly:
  - AI tool-call → Open in canvas
  - Canvas Library reference chip → Library resource detail
  - Library "used by" row → pipeline detail
  - Pipeline detail drift badge → upgrade modal
  - Metrics drill-down → Logs (pre-filtered + brushed range)
  - Log inspector drawer cross-link → schema / DLQ / trace
- [ ] Three viewports tested: 1280, 1440, 1920. Designs are 1680px-anchored. Below 1280, right-side panels collapse to icon-only or hidden.
- [ ] Empty states exist on every list and every chart.
- [ ] Loading states exist on every async surface and never produce layout shift on resolution.
- [ ] Error states exist on every async surface and never blank the page.
- [ ] No console errors in any reachable route.
- [ ] No `data-testid` placeholders or `TODO` strings ship in user-visible copy.

## Cross-cutting · always

- [ ] Pinned-vs-live contract holds across Library, Canvas, Bridge, and AI. Editing a connection is live; editing a schema or transform is pinned. No surface contradicts this.
- [ ] Pipeline-scope contract holds across Metrics and Logs. Cluster-wide views are explicitly out of scope.
- [ ] AI per-pipeline chat contract holds: one persistent chat per pipeline, plus one global chat. Chat scope is visible in the drawer header at all times.
- [ ] Brushed-range contract holds: pinning on Metrics propagates to Logs and back.
- [ ] Visual rhythm: mono is used for IDs, timestamps, axis labels, queries, code. Body sans is used for prose. Don't mix.
