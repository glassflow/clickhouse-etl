# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal DashboardClient with a full-featured system overview dashboard that renders four states (first-run, healthy, populated, incident) backed by a mock data layer.

**Architecture:** Server component (`page.tsx`) fetches pipeline list + dashboard stats via `getApiUrl()`, computes a discriminated `DashboardState`, and passes it to `DashboardClient`. `DashboardClient` renders the matching layout using components from `src/modules/dashboard/`. All data is mocked locally via two new API routes under `ui-api/mock/dashboard/` until real backend metrics APIs exist.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Vitest + Testing Library, CSS custom properties (no hardcoded hex), `getApiUrl()` for mock/real switching via `NEXT_PUBLIC_USE_MOCK_API`.

**Spec:** `docs/superpowers/specs/2026-05-06-dashboard-design.md`

---

## File Map

**Create:**
- `src/modules/dashboard/types.ts` — all TS types + `determineDashboardState()`
- `src/modules/dashboard/types.test.ts` — state determination tests
- `src/app/ui-api/mock/data/dashboard.ts` — 3-scenario seed data
- `src/app/ui-api/mock/dashboard/stats/route.ts` — GET stats + incidents + activity
- `src/app/ui-api/mock/dashboard/pipelines/route.ts` — GET dashboard pipeline rows
- `src/app/styles/dashboard.css` — all dashboard CSS classes (token-based)
- `src/modules/dashboard/components/DashHeader.tsx`
- `src/modules/dashboard/components/DashHeader.test.tsx`
- `src/modules/dashboard/components/KpiCard.tsx`
- `src/modules/dashboard/components/KpiStrip.tsx`
- `src/modules/dashboard/components/KpiStrip.test.tsx`
- `src/modules/dashboard/components/HealthyBanner.tsx`
- `src/modules/dashboard/components/HealthyBanner.test.tsx`
- `src/modules/dashboard/components/AttentionQueue.tsx`
- `src/modules/dashboard/components/AttentionQueue.test.tsx`
- `src/modules/dashboard/components/ThroughputChart.tsx`
- `src/modules/dashboard/components/ThroughputChart.test.tsx`
- `src/modules/dashboard/components/ActivityFeed.tsx`
- `src/modules/dashboard/components/ActivityFeed.test.tsx`
- `src/modules/dashboard/components/PipelineTable.tsx`
- `src/modules/dashboard/components/PipelineTable.test.tsx`
- `src/modules/dashboard/components/DashFirstRun.tsx`
- `src/modules/dashboard/components/DashFirstRun.test.tsx`
- `src/modules/dashboard/components/DashboardPage.tsx`
- `src/modules/dashboard/components/DashboardPage.test.tsx`

**Modify:**
- `vitest.config.ts` — add `modules/dashboard/**` to `include`
- `src/themes/base.css` — add 5 new surface tokens
- `src/themes/theme.css` — add semantic references for the new tokens
- `src/app/styles/index.css` — add `@import './dashboard.css'`
- `src/app/(shell)/dashboard/page.tsx` — fetch stats/pipelines, compute state
- `src/app/(shell)/dashboard/DashboardClient.tsx` — thin wrapper rendering `<DashboardPage>`
- `src/app/(main)/page.tsx` — redirect to `/dashboard` instead of `/pipelines` or `/home`
- `src/app/(shell)/home/page.tsx` — redirect to `/dashboard`

---

## Task 1: CSS Foundation — tokens, dashboard.css, vitest config

**Files:**
- Modify: `vitest.config.ts`
- Modify: `src/themes/base.css`
- Modify: `src/themes/theme.css`
- Create: `src/app/styles/dashboard.css`
- Modify: `src/app/styles/index.css`

- [ ] **Step 1: Add `modules/dashboard` to vitest include list**

In `vitest.config.ts`, add one line to the `include` array (after `modules/library`):

```ts
'modules/dashboard/**/*.{test,spec}.{ts,tsx}',
```

- [ ] **Step 2: Add surface tokens to `src/themes/base.css`**

Locate the block that has `--color-gray-dark-950` (around line 210) and add immediately after:

```css
  --color-surface-page: #070708;          /* dashboard page background */
  --color-surface-card: #0a0a0d;          /* KPI cards, attention queue, chart cards, pipeline table */
  --color-surface-subdued: #0c0c10;       /* pill backgrounds, table header row */
  --color-surface-element: #0e0e12;       /* version badge, CTA button, small UI chips */
  --color-surface-row-hover: rgba(255, 255, 255, 0.015); /* table / incident row hover */
```

- [ ] **Step 3: Add semantic references to `src/themes/theme.css`**

In `src/themes/theme.css`, in the `:root, [data-theme='dark']` block, add:

```css
  --dash-page-bg:      var(--color-surface-page);
  --dash-card-bg:      var(--color-surface-card);
  --dash-subdued-bg:   var(--color-surface-subdued);
  --dash-element-bg:   var(--color-surface-element);
  --dash-row-hover:    var(--color-surface-row-hover);
```

- [ ] **Step 4: Create `src/app/styles/dashboard.css`**

```css
/* =================================================================
   Dashboard — system overview, attention queue, pipeline table
   All color values via CSS custom properties. No hardcoded hex.
   ================================================================= */

.dash-page {
  background: var(--dash-page-bg);
  min-height: 100%;
  font-family: var(--font-family-body);
  color: var(--color-foreground-neutral);
  display: flex;
  flex-direction: column;
}

/* ── header ── */
.dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 40px 24px;
  border-bottom: 1px solid var(--color-gray-dark-800);
  flex-shrink: 0;
}
.dash-header-l { display: flex; flex-direction: column; gap: 4px; }
.dash-title {
  font-family: var(--font-archivo);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--color-foreground-neutral);
}
.dash-title.crit { color: var(--color-red-500); }
.dash-subtitle {
  font-size: 12.5px;
  color: var(--color-gray-dark-500);
  margin: 0;
}
.dash-subtitle.ok   { color: var(--color-green-500); }
.dash-subtitle.crit { color: var(--color-red-500); }
.dash-header-r { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

/* ── env / range / new-pipeline pills ── */
.dash-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--dash-subdued-bg);
  border: 1px solid var(--color-gray-dark-800);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-foreground-neutral);
  cursor: pointer;
  font-family: var(--font-family-body);
  text-decoration: none;
  white-space: nowrap;
}
.dash-pill .label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-gray-dark-500);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.dash-pill .val { color: var(--color-foreground-neutral); }
.dash-pill.is-primary {
  background: linear-gradient(180deg, var(--color-orange-200) 0%, var(--color-orange-500) 100%);
  border-color: var(--color-orange-400);
  color: var(--color-black);
  font-weight: 600;
}

/* ── KPI strip ── */
.dash-kpis {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 24px 40px;
  border-bottom: 1px solid var(--color-gray-dark-800);
  flex-shrink: 0;
}
.dash-kpi {
  background: var(--dash-card-bg);
  border: 1px solid var(--color-gray-dark-800);
  border-radius: 10px;
  padding: 16px 18px 14px;
  position: relative;
  overflow: hidden;
}
.dash-kpi .label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-gray-dark-500);
  margin-bottom: 10px;
}
.dash-kpi .value {
  font-family: var(--font-archivo);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--color-foreground-neutral);
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}
.dash-kpi .value .unit {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-gray-dark-500);
  font-family: var(--font-family-body);
}
.dash-kpi .delta {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dash-kpi .delta.up   { color: var(--color-green-500); }
.dash-kpi .delta.down { color: var(--color-red-500); }
.dash-kpi .delta.flat { color: var(--color-gray-dark-500); }
.dash-kpi.is-warn .value { color: var(--color-yellow-400); }
.dash-kpi.is-crit .value { color: var(--color-red-500); }
.dash-kpi-spark {
  position: absolute;
  right: 14px;
  top: 14px;
  opacity: 0.7;
}

/* ── healthy banner ── */
.healthy-banner {
  margin: 24px 40px 0;
  padding: 14px 20px;
  background: linear-gradient(90deg, var(--color-green-750) 0%, transparent 80%);
  border: 1px solid rgba(0, 211, 112, 0.3);
  border-left: 3px solid var(--color-green-500);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.healthy-banner .hb-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: var(--color-green-750);
  color: var(--color-green-500);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.healthy-banner .hb-body { flex: 1; }
.healthy-banner .hb-title {
  font-family: var(--font-archivo);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-foreground-neutral);
  margin-bottom: 2px;
}
.healthy-banner .hb-desc {
  font-size: 12px;
  color: var(--color-gray-dark-100);
  line-height: 1.5;
}
.healthy-banner .hb-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-gray-dark-500);
}

/* ── main grid ── */
.dash-main {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 18px;
  padding: 24px 40px 0;
}
.dash-main.healthy-layout {
  grid-template-columns: 1fr 1fr;
}

/* ── cards ── */
.dash-card {
  background: var(--dash-card-bg);
  border: 1px solid var(--color-gray-dark-800);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dash-card-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-gray-dark-800);
}
.dash-card-h h3 {
  font-family: var(--font-archivo);
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.005em;
  color: var(--color-foreground-neutral);
}
.dash-card-h .dash-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--color-gray-dark-500);
  margin-left: 8px;
}
.dash-card-h .dash-link {
  font-size: 11.5px;
  color: var(--color-gray-dark-100);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  text-decoration: none;
  background: none;
  border: none;
  padding: 0;
}
.dash-card-h .dash-link:hover { color: var(--color-orange-300); }

/* ── attention queue ── */
.attn-list { display: flex; flex-direction: column; }
.attn-row {
  display: grid;
  grid-template-columns: 4px 28px 1fr auto;
  gap: 14px;
  align-items: start;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-gray-dark-800);
  cursor: pointer;
  transition: background 120ms;
}
.attn-row:last-child { border-bottom: none; }
.attn-row:hover { background: var(--dash-row-hover); }
.attn-stripe {
  border-radius: 2px;
  align-self: stretch;
  margin-top: 2px;
}
.attn-row.crit .attn-stripe { background: var(--color-red-500); }
.attn-row.warn .attn-stripe { background: var(--color-yellow-400); }
.attn-row.info .attn-stripe { background: var(--color-blue-500); }
.attn-icon {
  width: 28px; height: 28px;
  border-radius: 6px;
  display: grid; place-items: center;
  flex-shrink: 0;
}
.attn-row.crit .attn-icon { background: var(--color-red-750);  color: var(--color-red-500); }
.attn-row.warn .attn-icon { background: rgba(247,212,120,0.08); color: var(--color-yellow-400); }
.attn-row.info .attn-icon { background: var(--color-blue-750); color: var(--color-blue-500); }
.attn-body .attn-title {
  font-family: var(--font-archivo);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-foreground-neutral);
  margin-bottom: 3px;
  letter-spacing: -0.005em;
}
.attn-pipe {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 11.5px;
  color: var(--color-orange-300);
  background: var(--color-orange-alpha-10);
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 6px;
}
.attn-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-gray-dark-100);
  margin-bottom: 8px;
}
.attn-meta {
  display: flex;
  gap: 14px;
  font-size: 10.5px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-gray-dark-500);
}
.attn-meta-sep { color: var(--color-gray-dark-700); }
.attn-cta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 5px;
  background: var(--dash-element-bg);
  border: 1px solid var(--color-gray-dark-700);
  font-size: 11px;
  font-family: var(--font-family-body);
  color: var(--color-gray-100);
  white-space: nowrap;
  cursor: pointer;
  transition: all 120ms;
}
.attn-cta:hover {
  background: var(--color-orange-alpha-10);
  border-color: var(--color-orange-300);
  color: var(--color-orange-300);
}
.attn-row.crit .attn-cta {
  background: var(--color-red-750);
  border-color: rgba(226,44,44,0.4);
  color: var(--color-red-500);
}

/* ── side stack ── */
.side-stack { display: flex; flex-direction: column; gap: 18px; }

/* ── throughput chart card ── */
.thru-card { padding: 18px; }
.thru-totals { display: flex; gap: 24px; margin-bottom: 16px; }
.thru-blk .thru-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-gray-dark-500);
}
.thru-blk .thru-val {
  font-family: var(--font-archivo);
  font-size: 18px;
  font-weight: 600;
  color: var(--color-foreground-neutral);
  margin-top: 2px;
}
.thru-blk .thru-unit {
  font-size: 11px;
  color: var(--color-gray-dark-500);
  font-family: var(--font-family-body);
  font-weight: 500;
  margin-left: 2px;
}
.thru-blk .thru-val.loss-warn { color: var(--color-yellow-400); }
.thru-blk .thru-val.loss-crit { color: var(--color-red-500); }
.thru-legend {
  display: flex;
  gap: 14px;
  font-size: 10.5px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-gray-dark-100);
  margin-top: 10px;
}
.thru-swatch {
  width: 8px; height: 8px;
  border-radius: 2px;
  display: inline-block;
  margin-right: 5px;
  vertical-align: 1px;
}

/* ── activity feed ── */
.activity-list { display: flex; flex-direction: column; }
.activity-row {
  display: grid;
  grid-template-columns: 16px 1fr auto;
  gap: 12px;
  padding: 11px 18px;
  align-items: center;
  border-bottom: 1px solid var(--color-gray-dark-800);
  font-size: 12px;
}
.activity-row:last-child { border-bottom: none; }
.activity-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  margin: 0 auto;
}
.activity-dot.deploy { background: var(--color-green-500); }
.activity-dot.pause  { background: var(--color-yellow-400); }
.activity-dot.fail   { background: var(--color-red-500); }
.activity-dot.info   { background: var(--color-blue-500); }
.activity-text { color: var(--color-gray-100); line-height: 1.4; }
.activity-text b { color: var(--color-foreground-neutral); font-weight: 600; }
.activity-pipe {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-orange-300);
}
.activity-when {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--color-gray-dark-500);
}

/* ── pipeline table ── */
.dash-table {
  background: var(--dash-card-bg);
  border: 1px solid var(--color-gray-dark-800);
  border-radius: 10px;
  overflow: hidden;
  margin: 24px 40px 40px;
}
.dash-table-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-gray-dark-800);
}
.dash-table-h h3 {
  font-family: var(--font-archivo);
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--color-foreground-neutral);
}
.dash-filters { display: flex; gap: 6px; align-items: center; }
.dash-filter-chip {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 5px;
  background: transparent;
  border: 1px solid var(--color-gray-dark-700);
  color: var(--color-gray-dark-100);
  cursor: pointer;
  font-family: var(--font-family-body);
}
.dash-filter-chip.is-active {
  background: var(--color-orange-alpha-10);
  border-color: var(--color-orange-300);
  color: var(--color-orange-300);
}
.dash-filter-n {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  margin-left: 4px;
  color: var(--color-gray-dark-500);
}
.dash-filter-chip.is-active .dash-filter-n { color: var(--color-orange-300); }
.dash-table table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.dash-table th {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-gray-dark-500);
  text-align: left;
  padding: 10px 16px;
  background: var(--dash-subdued-bg);
  border-bottom: 1px solid var(--color-gray-dark-800);
}
.dash-table th.r { text-align: right; }
.dash-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-gray-dark-800);
  color: var(--color-gray-100);
  vertical-align: middle;
}
.dash-table tr:last-child td { border-bottom: none; }
.dash-table tr:hover td { background: var(--dash-row-hover); }
.dash-table td.r { text-align: right; }
.pipe-name {
  font-family: var(--font-archivo);
  font-weight: 600;
  color: var(--color-foreground-neutral);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.pipe-ver {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 400;
  color: var(--color-gray-dark-500);
  background: var(--dash-element-bg);
  padding: 1px 5px;
  border-radius: 3px;
}
.pipe-route {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-gray-dark-100);
  display: flex;
  align-items: center;
  gap: 6px;
}
.pipe-arrow { color: var(--color-gray-dark-500); }
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.status-chip .dot { width: 6px; height: 6px; border-radius: 50%; }
.status-chip.run    { background: var(--color-green-750); color: var(--color-green-500); }
.status-chip.run .dot { background: var(--color-green-500); box-shadow: 0 0 0 2px rgba(0,211,112,0.18); }
.status-chip.deg    { background: rgba(247,212,120,0.08); color: var(--color-yellow-400); }
.status-chip.deg .dot { background: var(--color-yellow-400); }
.status-chip.fail   { background: var(--color-red-750);   color: var(--color-red-500); }
.status-chip.fail .dot { background: var(--color-red-500); }
.status-chip.paused { background: var(--color-blue-750);  color: var(--color-blue-500); }
.status-chip.paused .dot { background: var(--color-blue-500); }
.status-chip.draft  { background: rgba(255,255,255,0.04); color: var(--color-gray-100); border: 1px solid var(--color-gray-dark-700); }
.status-chip.draft .dot { background: var(--color-gray-dark-100); }
.metric-cell {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-foreground-neutral);
}
.metric-cell .u { color: var(--color-gray-dark-500); font-size: 10.5px; margin-left: 2px; }
.metric-cell .sub { display: block; font-size: 10px; color: var(--color-gray-dark-500); margin-top: 2px; }
.metric-cell.warn { color: var(--color-yellow-400); }
.metric-cell.crit { color: var(--color-red-500); }
.row-actions { display: flex; gap: 4px; justify-content: flex-end; }
.row-actions button {
  width: 26px; height: 26px;
  border-radius: 5px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-gray-dark-100);
  cursor: pointer;
  display: grid; place-items: center;
}
.row-actions button:hover {
  background: var(--color-orange-alpha-10);
  border-color: var(--color-gray-dark-700);
  color: var(--color-orange-300);
}

/* ── first-run empty state ── */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
}
.empty-card {
  width: 640px;
  max-width: 100%;
  background: var(--dash-card-bg);
  border: 1px solid var(--color-gray-dark-800);
  border-radius: 14px;
  padding: 48px 56px;
  text-align: center;
}
.empty-mark {
  width: 56px; height: 56px;
  margin: 0 auto 22px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-orange-200), var(--color-orange-500));
  display: grid; place-items: center;
  color: var(--color-black);
  box-shadow: 0 8px 24px -4px rgba(255,162,75,0.4);
}
.empty-card h2 {
  font-family: var(--font-archivo);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-foreground-neutral);
  margin: 0 0 8px;
}
.empty-card p {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--color-gray-dark-100);
  margin: 0 auto 28px;
  max-width: 460px;
}
.empty-paths {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-bottom: 24px;
}
.empty-path {
  padding: 14px 12px;
  border: 1px solid var(--color-gray-dark-800);
  border-radius: 8px;
  background: var(--dash-page-bg);
  text-align: left;
  cursor: pointer;
  transition: all 150ms;
  text-decoration: none;
  display: block;
}
.empty-path:hover {
  border-color: var(--color-orange-300);
  background: var(--color-orange-alpha-10);
}
.empty-path.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
  border-style: dashed;
}
.empty-ic-wrap {
  width: 28px; height: 28px;
  border-radius: 6px;
  background: var(--color-orange-alpha-10);
  color: var(--color-orange-300);
  display: grid; place-items: center;
  margin-bottom: 10px;
}
.empty-path.disabled .empty-ic-wrap {
  background: transparent;
  border: 1px dashed var(--color-gray-dark-700);
  color: var(--color-gray-dark-100);
}
.empty-path-name {
  font-family: var(--font-archivo);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-foreground-neutral);
  margin-bottom: 2px;
}
.empty-path-desc {
  font-size: 11px;
  color: var(--color-gray-dark-500);
  line-height: 1.45;
}
.empty-foot {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-gray-dark-500);
}
.empty-foot a { color: var(--color-orange-300); cursor: pointer; }
```

- [ ] **Step 5: Import dashboard.css in `src/app/styles/index.css`**

Add at the end of `src/app/styles/index.css`:
```css
@import './dashboard.css';
```

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/themes/base.css src/themes/theme.css \
        src/app/styles/dashboard.css src/app/styles/index.css
git commit -m "feat(dashboard): CSS foundation — tokens and dashboard.css"
```

---

## Task 2: Types and state determination

**Files:**
- Create: `src/modules/dashboard/types.ts`
- Create: `src/modules/dashboard/types.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/dashboard/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { determineDashboardState } from './types'
import type { DashPipeline, Incident, DashStats, ActivityItem } from './types'

const stats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 42600, eventsPerSecDelta: 8.2,
  errorRate: 0.34, errorRateDelta: 0.21,
  dlqEvents: 2847, dlqDelta: 412,
  avgLagMs: 1200, avgLagMsDelta: 0,
  throughputIn: 153400000, throughputOut: 152800000, throughputLossPct: 0.39,
  throughputSeries: { in: Array(60).fill(720), out: Array(60).fill(702) },
}
const activity: ActivityItem[] = []

const runPipeline: DashPipeline = {
  id: 'p1', name: 'orders', version: 'v12', sourceTopic: 'orders.events',
  destTable: 'analytics.orders', status: 'run', statusLabel: 'running',
  throughput: '8.4k', throughputUnit: '/s', lagP95: '1.2', lagUnit: 's',
  dlq: '0', lastDeploy: '14m ago', deployedBy: 'maria.a',
}
const failPipeline: DashPipeline = { ...runPipeline, status: 'fail', statusLabel: 'failing' }

const incident: Incident = {
  id: 'i1', severity: 'crit', pipelineName: 'orders',
  title: 'DLQ growing', description: 'desc', meta: ['47m ago'], ctaLabel: 'Fix it',
}

describe('determineDashboardState', () => {
  it('returns first-run when no pipelines', () => {
    const state = determineDashboardState([], [], stats, activity)
    expect(state.kind).toBe('first-run')
  })

  it('returns healthy when pipelines exist but no incidents', () => {
    const state = determineDashboardState([runPipeline], [], stats, activity)
    expect(state.kind).toBe('healthy')
  })

  it('returns populated for 1–5 incidents with no failing pipeline', () => {
    const state = determineDashboardState([runPipeline], [incident], stats, activity)
    expect(state.kind).toBe('populated')
  })

  it('returns incident when any pipeline has status fail', () => {
    const state = determineDashboardState([failPipeline], [incident], stats, activity)
    expect(state.kind).toBe('incident')
  })

  it('returns incident when incident count exceeds 5', () => {
    const many = Array(6).fill(incident)
    const state = determineDashboardState([runPipeline], many, stats, activity)
    expect(state.kind).toBe('incident')
  })

  it('healthy state carries pipelines, stats, and activity', () => {
    const state = determineDashboardState([runPipeline], [], stats, activity)
    if (state.kind !== 'healthy') throw new Error('wrong kind')
    expect(state.pipelines).toHaveLength(1)
    expect(state.stats.activePipelines).toBe(14)
  })

  it('populated state carries incidents', () => {
    const state = determineDashboardState([runPipeline], [incident], stats, activity)
    if (state.kind !== 'populated') throw new Error('wrong kind')
    expect(state.incidents).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
pnpm test:run src/modules/dashboard/types.test.ts
```

Expected: `Cannot find module './types'`

- [ ] **Step 3: Create `src/modules/dashboard/types.ts`**

```ts
export type IncidentSeverity = 'crit' | 'warn' | 'info'

export type Incident = {
  id: string
  severity: IncidentSeverity
  pipelineName: string
  title: string
  description: string
  meta: string[]
  ctaLabel: string
  ctaHref?: string
}

export type ActivityKind = 'deploy' | 'fail' | 'pause' | 'info'

export type ActivityItem = {
  kind: ActivityKind
  text: string
  pipelineName?: string
  actor?: string
  relativeTime: string
}

export type DashPipelineStatus = 'run' | 'deg' | 'fail' | 'paused' | 'draft'

export type DashPipeline = {
  id: string
  name: string
  version: string
  sourceTopic: string
  destTable: string
  status: DashPipelineStatus
  statusLabel: string
  throughput: string
  throughputUnit: string
  lagP95: string
  lagUnit: string
  lagSeverity?: 'warn' | 'crit'
  dlq: string
  dlqSeverity?: 'warn' | 'crit'
  lastDeploy: string
  deployedBy: string
}

export type DashStats = {
  activePipelines: number
  totalPipelines: number
  eventsPerSec: number
  eventsPerSecDelta: number
  errorRate: number
  errorRateDelta: number
  dlqEvents: number
  dlqDelta: number
  avgLagMs: number
  avgLagMsDelta: number
  throughputIn: number
  throughputOut: number
  throughputLossPct: number
  throughputSeries: { in: number[]; out: number[] }
}

export type DashboardState =
  | { kind: 'first-run' }
  | { kind: 'healthy';   pipelines: DashPipeline[]; stats: DashStats; activity: ActivityItem[] }
  | { kind: 'populated'; pipelines: DashPipeline[]; stats: DashStats; incidents: Incident[]; activity: ActivityItem[] }
  | { kind: 'incident';  pipelines: DashPipeline[]; stats: DashStats; incidents: Incident[]; activity: ActivityItem[] }

export function determineDashboardState(
  pipelines: DashPipeline[],
  incidents: Incident[],
  stats: DashStats,
  activity: ActivityItem[],
): DashboardState {
  if (pipelines.length === 0) return { kind: 'first-run' }
  if (incidents.length === 0) return { kind: 'healthy', pipelines, stats, activity }
  const isIncident = incidents.length > 5 || pipelines.some((p) => p.status === 'fail')
  if (isIncident) return { kind: 'incident', pipelines, stats, incidents, activity }
  return { kind: 'populated', pipelines, stats, incidents, activity }
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
pnpm test:run src/modules/dashboard/types.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/types.ts src/modules/dashboard/types.test.ts
git commit -m "feat(dashboard): types and determineDashboardState"
```

---

## Task 3: Mock seed data and API routes

**Files:**
- Create: `src/app/ui-api/mock/data/dashboard.ts`
- Create: `src/app/ui-api/mock/dashboard/stats/route.ts`
- Create: `src/app/ui-api/mock/dashboard/pipelines/route.ts`

- [ ] **Step 1: Create seed data `src/app/ui-api/mock/data/dashboard.ts`**

```ts
import type { DashStats, Incident, ActivityItem, DashPipeline } from '@/src/modules/dashboard/types'

// ── stats ─────────────────────────────────────────────────────────────────

const SERIES_N = 60

function sinSeries(base: number, amp: number, freq: number): number[] {
  return Array.from({ length: SERIES_N }, (_, i) => base + Math.sin(i / freq) * amp)
}

const populatedStats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 42600, eventsPerSecDelta: 8.2,
  errorRate: 0.34, errorRateDelta: 0.21,
  dlqEvents: 2847, dlqDelta: 412,
  avgLagMs: 1200, avgLagMsDelta: 0,
  throughputIn: 153400000, throughputOut: 152800000, throughputLossPct: 0.39,
  throughputSeries: {
    in: sinSeries(720, 120, 4).map((v, i) => v + Math.cos(i / 9) * 80 + i * 2),
    out: sinSeries(702, 100, 4).map((v, i) => v + Math.cos(i / 9) * 80 + i * 2),
  },
}

const healthyStats: DashStats = {
  activePipelines: 14, totalPipelines: 14,
  eventsPerSec: 38100, eventsPerSecDelta: 2.1,
  errorRate: 0.02, errorRateDelta: 0,
  dlqEvents: 8, dlqDelta: 0,
  avgLagMs: 340, avgLagMsDelta: 0,
  throughputIn: 137160000, throughputOut: 136900000, throughputLossPct: 0.19,
  throughputSeries: {
    in: sinSeries(640, 40, 6),
    out: sinSeries(625, 40, 6),
  },
}

const incidentStats: DashStats = {
  activePipelines: 11, totalPipelines: 14,
  eventsPerSec: 28400, eventsPerSecDelta: -33,
  errorRate: 3.81, errorRateDelta: 3.59,
  dlqEvents: 14029, dlqDelta: 8200,
  avgLagMs: 8400, avgLagMsDelta: 7200,
  throughputIn: 102200000, throughputOut: 88200000, throughputLossPct: 13.7,
  throughputSeries: {
    in: Array.from({ length: SERIES_N }, (_, i) => 720 - i * 8),
    out: Array.from({ length: SERIES_N }, (_, i) => 720 - i * 10),
  },
}

// ── incidents ─────────────────────────────────────────────────────────────

const populatedIncidents: Incident[] = [
  {
    id: 'i1', severity: 'crit', pipelineName: 'orders-to-clickhouse',
    title: 'DLQ growing — schema mismatch on user_id',
    description: '412 events failed in the last hour. Source emits String, target expects UInt64. Suggested: cast in transform, or update ClickHouse column.',
    meta: ['started 47m ago', '412 events', 'v12 · revision 2025-05-04'],
    ctaLabel: 'Fix it',
  },
  {
    id: 'i2', severity: 'warn', pipelineName: 'events-stream-prod',
    title: 'Schema orders.v4 drift detected',
    description: 'Source has added 2 new fields (currency, region). Pipeline pinned to v3 — silently dropped today: 12,440 events.',
    meta: ['detected 2h ago', 'affects 3 pipelines', '2 new fields'],
    ctaLabel: 'Review drift',
  },
  {
    id: 'i3', severity: 'info', pipelineName: 'analytics-otlp-logs',
    title: 'Deploy v8 stuck in validating',
    description: 'ClickHouse insert validation hasn't completed in 4 minutes. Pipeline still running on v7. Safe to retry or roll back.',
    meta: ['started 4m ago', 'deployed by daniel.k', 'autorollback in 6m'],
    ctaLabel: 'Inspect',
  },
]

const incidentIncidents: Incident[] = [
  {
    id: 'i1', severity: 'crit', pipelineName: 'stripe-payments-cdc',
    title: 'ClickHouse insert failures — connection refused',
    description: 'Sink connection to analytics-prod.eu-central-1 dropping every 30s. 8,420 events queued. ClickHouse cluster shows replica lag > 60s.',
    meta: ['started 18m ago', '8,420 events', '5 retries'],
    ctaLabel: 'Inspect',
  },
  {
    id: 'i2', severity: 'crit', pipelineName: 'orders-to-clickhouse',
    title: 'DLQ growing — type mismatch on user_id',
    description: '5,609 events failed. Source emits String, target expects UInt64.',
    meta: ['started 47m ago', '5,609 events'],
    ctaLabel: 'Fix it',
  },
  {
    id: 'i3', severity: 'warn', pipelineName: 'events-stream-prod',
    title: 'Schema drift · 3 affected pipelines',
    description: 'Source added currency, region. Silently dropped today: 12,440 events.',
    meta: ['detected 2h ago'],
    ctaLabel: 'Review',
  },
  {
    id: 'i4', severity: 'warn', pipelineName: 'user-events-otlp',
    title: 'Lag exceeded threshold (5s)',
    description: 'P95 lag is 8.4s, sustained for 12m.',
    meta: ['started 12m ago'],
    ctaLabel: 'Open metrics',
  },
  {
    id: 'i5', severity: 'warn', pipelineName: 'user-events-otlp',
    title: 'Memory pressure — consumer group lagging',
    description: 'Consumer lag for group analytics-consumer is growing at 200 events/s.',
    meta: ['started 8m ago'],
    ctaLabel: 'View metrics',
  },
  {
    id: 'i6', severity: 'info', pipelineName: 'analytics-otlp-logs',
    title: 'Deploy v8 still validating',
    description: 'Validation pending 4m. Pipeline still on v7. Safe to retry or roll back.',
    meta: ['started 4m ago'],
    ctaLabel: 'Inspect',
  },
]

// ── activity ──────────────────────────────────────────────────────────────

const populatedActivity: ActivityItem[] = [
  { kind: 'deploy', text: 'deployed orders-to-clickhouse v12', actor: 'maria.a', pipelineName: 'orders-to-clickhouse', relativeTime: '14m ago' },
  { kind: 'info',   text: 'Schema orders.v4 published — 3 pipelines flagged for drift', relativeTime: '2h ago' },
  { kind: 'fail',   text: 'deploy v8 entered validating state', pipelineName: 'analytics-otlp-logs', relativeTime: '4m ago' },
  { kind: 'deploy', text: 'rolled back stripe-payments-cdc to v6', actor: 'daniel.k', pipelineName: 'stripe-payments-cdc', relativeTime: '3h ago' },
  { kind: 'pause',  text: 'paused test-events-staging', actor: 'vanessa.c', pipelineName: 'test-events-staging', relativeTime: '5h ago' },
]

const incidentActivity: ActivityItem[] = [
  { kind: 'fail',  text: 'insert failed', pipelineName: 'stripe-payments-cdc', relativeTime: '2m' },
  { kind: 'fail',  text: 'DLQ +412', pipelineName: 'orders-to-clickhouse', relativeTime: '14m' },
  { kind: 'pause', text: 'paused test-events-staging', actor: 'auto', pipelineName: 'test-events-staging', relativeTime: '22m' },
  { kind: 'info',  text: 'Schema orders.v4 drift detected', relativeTime: '2h' },
]

// ── pipelines ─────────────────────────────────────────────────────────────

const populatedPipelines: DashPipeline[] = [
  { id: 'p1', name: 'orders-to-clickhouse',  version: 'v12', sourceTopic: 'orders.events',  destTable: 'analytics.orders',  status: 'deg',    statusLabel: 'degraded',                  throughput: '8.4k',  throughputUnit: '/s', lagP95: '1.2', lagUnit: 's',   dlq: '412',  dlqSeverity: 'crit', lastDeploy: '14m ago', deployedBy: 'maria.a' },
  { id: 'p2', name: 'stripe-payments-cdc',   version: 'v6',  sourceTopic: 'stripe.cdc',      destTable: 'fin.payments',      status: 'run',    statusLabel: 'running',                   throughput: '2.1k',  throughputUnit: '/s', lagP95: '420', lagUnit: 'ms',  dlq: '0',    lastDeploy: '3h ago',  deployedBy: 'daniel.k' },
  { id: 'p3', name: 'user-events-otlp',      version: 'v9',  sourceTopic: 'otlp.events',     destTable: 'analytics.users',   status: 'run',    statusLabel: 'running',                   throughput: '18.4k', throughputUnit: '/s', lagP95: '860', lagUnit: 'ms',  dlq: '12',   lastDeploy: '2d ago',  deployedBy: 'maria.a' },
  { id: 'p4', name: 'analytics-otlp-logs',   version: 'v7',  sourceTopic: 'otlp.logs',       destTable: 'analytics.logs',    status: 'run',    statusLabel: 'running · v8 validating',   throughput: '9.8k',  throughputUnit: '/s', lagP95: '1.4', lagUnit: 's',   dlq: '8',    lastDeploy: '4m ago',  deployedBy: 'daniel.k' },
  { id: 'p5', name: 'events-stream-prod',    version: 'v4',  sourceTopic: 'events.prod',     destTable: 'analytics.events',  status: 'run',    statusLabel: 'running',                   throughput: '4.0k',  throughputUnit: '/s', lagP95: '520', lagUnit: 'ms',  dlq: '0',    lastDeploy: '1w ago',  deployedBy: 'vanessa.c' },
  { id: 'p6', name: 'test-events-staging',   version: 'v2',  sourceTopic: 'events.test',     destTable: 'staging.events',    status: 'paused', statusLabel: 'paused',                    throughput: '—',     throughputUnit: '',   lagP95: '—',   lagUnit: '',    dlq: '—',    lastDeploy: '5h ago',  deployedBy: 'vanessa.c' },
]

const healthyPipelines: DashPipeline[] = [
  { id: 'p1', name: 'orders-to-clickhouse',  version: 'v12', sourceTopic: 'orders.events',  destTable: 'analytics.orders', status: 'run', statusLabel: 'running', throughput: '8.2k',  throughputUnit: '/s', lagP95: '420', lagUnit: 'ms', dlq: '2',  lastDeploy: '2d ago', deployedBy: 'maria.a' },
  { id: 'p2', name: 'stripe-payments-cdc',   version: 'v6',  sourceTopic: 'stripe.cdc',     destTable: 'fin.payments',     status: 'run', statusLabel: 'running', throughput: '2.1k',  throughputUnit: '/s', lagP95: '380', lagUnit: 'ms', dlq: '0',  lastDeploy: '3d ago', deployedBy: 'daniel.k' },
  { id: 'p3', name: 'user-events-otlp',      version: 'v9',  sourceTopic: 'otlp.events',    destTable: 'analytics.users',  status: 'run', statusLabel: 'running', throughput: '18.4k', throughputUnit: '/s', lagP95: '420', lagUnit: 'ms', dlq: '4',  lastDeploy: '1w ago', deployedBy: 'maria.a' },
  { id: 'p4', name: 'analytics-otlp-logs',   version: 'v7',  sourceTopic: 'otlp.logs',      destTable: 'analytics.logs',   status: 'run', statusLabel: 'running', throughput: '9.4k',  throughputUnit: '/s', lagP95: '340', lagUnit: 'ms', dlq: '2',  lastDeploy: '2w ago', deployedBy: 'daniel.k' },
  { id: 'p5', name: 'events-stream-prod',    version: 'v4',  sourceTopic: 'events.prod',    destTable: 'analytics.events', status: 'run', statusLabel: 'running', throughput: '4.0k',  throughputUnit: '/s', lagP95: '400', lagUnit: 'ms', dlq: '0',  lastDeploy: '1w ago', deployedBy: 'vanessa.c' },
]

const incidentPipelines: DashPipeline[] = [
  { id: 'p1', name: 'stripe-payments-cdc',   version: 'v6',  sourceTopic: 'stripe.cdc',     destTable: 'fin.payments',      status: 'fail',   statusLabel: 'failing',                  throughput: '320',   throughputUnit: '/s', lagP95: '12.4', lagUnit: 's', lagSeverity: 'crit', dlq: '8,420', dlqSeverity: 'crit', lastDeploy: '3h ago',  deployedBy: 'daniel.k' },
  { id: 'p2', name: 'orders-to-clickhouse',  version: 'v12', sourceTopic: 'orders.events',  destTable: 'analytics.orders',  status: 'deg',    statusLabel: 'degraded',                 throughput: '4.1k',  throughputUnit: '/s', lagP95: '2.4',  lagUnit: 's', lagSeverity: 'warn', dlq: '5,609', dlqSeverity: 'crit', lastDeploy: '14m ago', deployedBy: 'maria.a' },
  { id: 'p3', name: 'user-events-otlp',      version: 'v9',  sourceTopic: 'otlp.events',    destTable: 'analytics.users',   status: 'deg',    statusLabel: 'degraded · lag',           throughput: '14.2k', throughputUnit: '/s', lagP95: '8.4',  lagUnit: 's', lagSeverity: 'warn', dlq: '12',   lastDeploy: '2d ago',  deployedBy: 'maria.a' },
  { id: 'p4', name: 'analytics-otlp-logs',   version: 'v7',  sourceTopic: 'otlp.logs',      destTable: 'analytics.logs',    status: 'run',    statusLabel: 'running · v8 validating',  throughput: '9.8k',  throughputUnit: '/s', lagP95: '1.4',  lagUnit: 's', dlq: '8',    lastDeploy: '4m ago',  deployedBy: 'daniel.k' },
  { id: 'p5', name: 'events-stream-prod',    version: 'v4',  sourceTopic: 'events.prod',    destTable: 'analytics.events',  status: 'run',    statusLabel: 'running',                  throughput: '4.0k',  throughputUnit: '/s', lagP95: '520',  lagUnit: 'ms', dlq: '0',   lastDeploy: '1w ago',  deployedBy: 'vanessa.c' },
]

// ── exported lookup ───────────────────────────────────────────────────────

type Scenario = 'populated' | 'healthy' | 'incident'

type ScenarioData = {
  stats: DashStats
  incidents: Incident[]
  activity: ActivityItem[]
  pipelines: DashPipeline[]
}

const scenarios: Record<Scenario, ScenarioData> = {
  populated: { stats: populatedStats, incidents: populatedIncidents, activity: populatedActivity, pipelines: populatedPipelines },
  healthy:   { stats: healthyStats,   incidents: [],                  activity: populatedActivity, pipelines: healthyPipelines },
  incident:  { stats: incidentStats,  incidents: incidentIncidents,   activity: incidentActivity,  pipelines: incidentPipelines },
}

export function getDashboardScenario(raw?: string | null): ScenarioData {
  const key = (raw ?? 'populated') as Scenario
  return scenarios[key] ?? scenarios.populated
}
```

- [ ] **Step 2: Create `src/app/ui-api/mock/dashboard/stats/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDashboardScenario } from '../../data/dashboard'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { stats, incidents, activity } = getDashboardScenario(searchParams.get('scenario'))
  return NextResponse.json({ stats, incidents, activity })
}
```

- [ ] **Step 3: Create `src/app/ui-api/mock/dashboard/pipelines/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDashboardScenario } from '../../data/dashboard'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { pipelines } = getDashboardScenario(searchParams.get('scenario'))
  return NextResponse.json({ pipelines })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/ui-api/mock/data/dashboard.ts \
        src/app/ui-api/mock/dashboard/stats/route.ts \
        src/app/ui-api/mock/dashboard/pipelines/route.ts
git commit -m "feat(dashboard): mock seed data and API routes (3 scenarios)"
```

---

## Task 4: DashHeader component

**Files:**
- Create: `src/modules/dashboard/components/DashHeader.tsx`
- Create: `src/modules/dashboard/components/DashHeader.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/DashHeader.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashHeader } from './DashHeader'
import type { DashboardState } from '../types'

const noop = vi.fn()
const baseProps = { env: 'production', range: 'last 1h', onEnvChange: noop, onRangeChange: noop }

describe('DashHeader', () => {
  it('shows "Welcome to GlassFlow" in first-run state', () => {
    const state: DashboardState = { kind: 'first-run' }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to GlassFlow')
  })

  it('shows "Dashboard" in healthy state', () => {
    const state: DashboardState = {
      kind: 'healthy', pipelines: [], stats: {} as any, activity: [],
    }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
  })

  it('shows "Several pipelines need attention" in incident state', () => {
    const state: DashboardState = {
      kind: 'incident', pipelines: [], stats: {} as any, incidents: [], activity: [],
    }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Several pipelines need attention')
  })

  it('shows env and range pills in non-first-run state', () => {
    const state: DashboardState = { kind: 'healthy', pipelines: [], stats: {} as any, activity: [] }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByText('production')).toBeInTheDocument()
    expect(screen.getByText('last 1h')).toBeInTheDocument()
  })

  it('shows Docs and Demo pills in first-run state instead of env/range', () => {
    const state: DashboardState = { kind: 'first-run' }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText(/Watch demo/)).toBeInTheDocument()
    expect(screen.queryByText('production')).not.toBeInTheDocument()
  })

  it('healthy subtitle mentions "running smoothly"', () => {
    const state: DashboardState = {
      kind: 'healthy', pipelines: [{ id: 'p1' } as any], stats: {} as any, activity: [],
    }
    render(<DashHeader state={state} {...baseProps} />)
    expect(screen.getByText(/running smoothly/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/DashHeader.test.tsx
```

Expected: `Cannot find module './DashHeader'`

- [ ] **Step 3: Create `src/modules/dashboard/components/DashHeader.tsx`**

```tsx
'use client'

import type { DashboardState } from '../types'

type Props = {
  state: DashboardState
  env: string
  range: string
  onEnvChange: (v: string) => void
  onRangeChange: (v: string) => void
}

function subtitleText(state: DashboardState): { text: string; mod: string } {
  switch (state.kind) {
    case 'first-run':
      return {
        text: 'Stream Kafka, OTLP, or anything else into ClickHouse — without writing a consumer.',
        mod: '',
      }
    case 'healthy':
      return {
        text: `Everything's running smoothly · ${state.pipelines.length} pipelines active`,
        mod: 'ok',
      }
    case 'populated': {
      const n = state.incidents.length
      return {
        text: `${n} ${n === 1 ? 'thing' : 'things'} need your attention · ${state.stats.activePipelines} pipelines active`,
        mod: '',
      }
    }
    case 'incident': {
      const crit = state.incidents.filter((i) => i.severity === 'crit').length
      const warn = state.incidents.filter((i) => i.severity === 'warn').length
      const deploying = state.pipelines.filter((p) => p.statusLabel.includes('validating')).length
      const parts = [
        crit > 0 && `${crit} critical`,
        warn > 0 && `${warn} warnings`,
        deploying > 0 && `${deploying} deploy in progress`,
      ].filter(Boolean)
      return { text: parts.join(' · '), mod: 'crit' }
    }
  }
}

export function DashHeader({ state, env, range, onEnvChange, onRangeChange }: Props) {
  const isFirstRun = state.kind === 'first-run'
  const isIncident = state.kind === 'incident'
  const title = isIncident
    ? 'Several pipelines need attention'
    : isFirstRun
      ? 'Welcome to GlassFlow'
      : 'Dashboard'
  const sub = subtitleText(state)

  return (
    <div className="dash-header">
      <div className="dash-header-l">
        <h1 className={`dash-title${isIncident ? ' crit' : ''}`}>{title}</h1>
        <p className={`dash-subtitle${sub.mod ? ` ${sub.mod}` : ''}`}>{sub.text}</p>
      </div>
      <div className="dash-header-r">
        {isFirstRun ? (
          <>
            <button className="dash-pill" type="button">Documentation</button>
            <button className="dash-pill" type="button">Watch demo · 3min</button>
          </>
        ) : (
          <>
            <button className="dash-pill" type="button" onClick={() => onEnvChange(env)}>
              <span className="label">env</span>
              <span className="val">{env}</span>
            </button>
            <button className="dash-pill" type="button" onClick={() => onRangeChange(range)}>
              <span className="label">range</span>
              <span className="val">{range}</span>
            </button>
            <a href="/" className="dash-pill is-primary">+ New pipeline</a>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all tests to pass**

```bash
pnpm test:run src/modules/dashboard/components/DashHeader.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/components/DashHeader.tsx \
        src/modules/dashboard/components/DashHeader.test.tsx
git commit -m "feat(dashboard): DashHeader component"
```

---

## Task 5: KpiCard and KpiStrip

**Files:**
- Create: `src/modules/dashboard/components/KpiCard.tsx`
- Create: `src/modules/dashboard/components/KpiStrip.tsx`
- Create: `src/modules/dashboard/components/KpiStrip.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/KpiStrip.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiStrip } from './KpiStrip'
import type { DashStats } from '../types'

const stats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 42600, eventsPerSecDelta: 8.2,
  errorRate: 0.34, errorRateDelta: 0.21,
  dlqEvents: 2847, dlqDelta: 412,
  avgLagMs: 1200, avgLagMsDelta: 0,
  throughputIn: 0, throughputOut: 0, throughputLossPct: 0,
  throughputSeries: { in: [], out: [] },
}

describe('KpiStrip', () => {
  it('renders all 5 KPI labels', () => {
    render(<KpiStrip stats={stats} />)
    expect(screen.getByText(/Active pipelines/i)).toBeInTheDocument()
    expect(screen.getByText(/Events \/ sec/i)).toBeInTheDocument()
    expect(screen.getByText(/Error rate/i)).toBeInTheDocument()
    expect(screen.getByText(/DLQ events/i)).toBeInTheDocument()
    expect(screen.getByText(/Avg lag/i)).toBeInTheDocument()
  })

  it('shows pipeline count as "14 / 16"', () => {
    render(<KpiStrip stats={stats} />)
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('/ 16')).toBeInTheDocument()
  })

  it('applies is-warn class when error rate > 0.1%', () => {
    const { container } = render(<KpiStrip stats={{ ...stats, errorRate: 0.5 }} />)
    const warnCard = container.querySelector('.dash-kpi.is-warn')
    expect(warnCard).not.toBeNull()
  })

  it('applies is-crit class when error rate > 1%', () => {
    const { container } = render(<KpiStrip stats={{ ...stats, errorRate: 2.5 }} />)
    const critCard = container.querySelector('.dash-kpi.is-crit')
    expect(critCard).not.toBeNull()
  })

  it('applies is-crit class when DLQ > 1000', () => {
    const { container } = render(<KpiStrip stats={{ ...stats, dlqEvents: 1500 }} />)
    const critCards = container.querySelectorAll('.dash-kpi.is-crit')
    expect(critCards.length).toBeGreaterThan(0)
  })

  it('shows delta with up direction for positive events/sec delta', () => {
    const { container } = render(<KpiStrip stats={{ ...stats, eventsPerSecDelta: 8.2 }} />)
    const upDelta = container.querySelector('.delta.up')
    expect(upDelta).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/KpiStrip.test.tsx
```

Expected: `Cannot find module './KpiStrip'`

- [ ] **Step 3: Create `src/modules/dashboard/components/KpiCard.tsx`**

```tsx
'use client'

export type KpiSeverity = 'default' | 'warn' | 'crit'
export type DeltaDir = 'up' | 'down' | 'flat'

type SparkProps = { data: number[]; color?: string }

function Spark({ data, color = 'var(--color-gray-dark-100)' }: SparkProps) {
  if (data.length < 2) return null
  const w = 64, h = 24
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} className="dash-kpi-spark" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Props = {
  label: string
  value: string
  unit?: string
  delta: string
  deltaDir: DeltaDir
  severity?: KpiSeverity
  sparkData: number[]
  sparkColor?: string
}

export function KpiCard({ label, value, unit, delta, deltaDir, severity = 'default', sparkData, sparkColor }: Props) {
  const cls = `dash-kpi${severity === 'warn' ? ' is-warn' : severity === 'crit' ? ' is-crit' : ''}`
  return (
    <div className={cls}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <span className={`delta ${deltaDir}`}>{delta}</span>
      <Spark data={sparkData} color={sparkColor} />
    </div>
  )
}
```

- [ ] **Step 4: Create `src/modules/dashboard/components/KpiStrip.tsx`**

```tsx
'use client'

import { KpiCard } from './KpiCard'
import type { DashStats } from '../types'

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtDelta(d: number, decimals = 1): string {
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(decimals)}%`
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}` : String(ms)
}

function msUnit(ms: number): string {
  return ms >= 1000 ? 's · p95' : 'ms · p95'
}

type Props = { stats: DashStats }

export function KpiStrip({ stats }: Props) {
  const errorSeverity = stats.errorRate > 1 ? 'crit' : stats.errorRate > 0.1 ? 'warn' : 'default'
  const dlqSeverity = stats.dlqEvents > 1000 ? 'crit' : stats.dlqEvents > 100 ? 'warn' : 'default'
  const lagSeverity = stats.avgLagMs > 2000 ? 'warn' : 'default'
  const evDelta = stats.eventsPerSecDelta
  const errDelta = stats.errorRateDelta
  const dlqDelta = stats.dlqDelta
  const lagDelta = stats.avgLagMsDelta

  return (
    <div className="dash-kpis">
      <KpiCard
        label="Active pipelines"
        value={String(stats.activePipelines)}
        unit={`/ ${stats.totalPipelines}`}
        delta="no change · 1h"
        deltaDir="flat"
        sparkData={Array(12).fill(stats.activePipelines)}
      />
      <KpiCard
        label="Events / sec"
        value={fmtNumber(stats.eventsPerSec)}
        unit="in"
        delta={fmtDelta(evDelta)}
        deltaDir={evDelta > 0 ? 'up' : evDelta < 0 ? 'down' : 'flat'}
        sparkData={stats.throughputSeries.in.slice(0, 12)}
        sparkColor="var(--color-orange-300)"
      />
      <KpiCard
        label="Error rate"
        value={stats.errorRate.toFixed(2)}
        unit="%"
        delta={fmtDelta(errDelta)}
        deltaDir={errDelta > 0 ? 'down' : errDelta < 0 ? 'up' : 'flat'}
        severity={errorSeverity}
        sparkData={stats.throughputSeries.out.slice(0, 12)}
        sparkColor="var(--color-yellow-400)"
      />
      <KpiCard
        label="DLQ events"
        value={stats.dlqEvents.toLocaleString()}
        delta={dlqDelta > 0 ? `+${dlqDelta.toLocaleString()} · 1h` : 'stable'}
        deltaDir={dlqDelta > 0 ? 'down' : 'flat'}
        severity={dlqSeverity}
        sparkData={stats.throughputSeries.in.slice(0, 12).map((v) => v * 0.001)}
        sparkColor="var(--color-red-500)"
      />
      <KpiCard
        label="Avg lag"
        value={fmtMs(stats.avgLagMs)}
        unit={msUnit(stats.avgLagMs)}
        delta={lagDelta === 0 ? 'stable' : fmtDelta(lagDelta / 1000)}
        deltaDir={lagDelta > 0 ? 'down' : lagDelta < 0 ? 'up' : 'flat'}
        severity={lagSeverity}
        sparkData={Array(12).fill(stats.avgLagMs)}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run — expect all tests to pass**

```bash
pnpm test:run src/modules/dashboard/components/KpiStrip.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dashboard/components/KpiCard.tsx \
        src/modules/dashboard/components/KpiStrip.tsx \
        src/modules/dashboard/components/KpiStrip.test.tsx
git commit -m "feat(dashboard): KpiCard and KpiStrip components"
```

---

## Task 6: HealthyBanner component

**Files:**
- Create: `src/modules/dashboard/components/HealthyBanner.tsx`
- Create: `src/modules/dashboard/components/HealthyBanner.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/HealthyBanner.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthyBanner } from './HealthyBanner'

describe('HealthyBanner', () => {
  it('renders the all-healthy title', () => {
    render(<HealthyBanner lastIncident="4d 12h ago" />)
    expect(screen.getByText('All pipelines healthy')).toBeInTheDocument()
  })

  it('renders the description text', () => {
    render(<HealthyBanner lastIncident="4d 12h ago" />)
    expect(screen.getByText(/No incidents in the last 24 hours/)).toBeInTheDocument()
  })

  it('displays last incident time', () => {
    render(<HealthyBanner lastIncident="4d 12h ago" />)
    expect(screen.getByText(/4d 12h ago/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/HealthyBanner.test.tsx
```

- [ ] **Step 3: Create `src/modules/dashboard/components/HealthyBanner.tsx`**

```tsx
'use client'

import { CheckIcon } from 'lucide-react'

type Props = { lastIncident: string }

export function HealthyBanner({ lastIncident }: Props) {
  return (
    <div className="healthy-banner">
      <div className="hb-icon" aria-hidden="true">
        <CheckIcon size={18} />
      </div>
      <div className="hb-body">
        <div className="hb-title">All pipelines healthy</div>
        <div className="hb-desc">
          No incidents in the last 24 hours · No schema drift · DLQ stable at 0.02% of throughput
        </div>
      </div>
      <div className="hb-meta">last incident · {lastIncident}</div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/modules/dashboard/components/HealthyBanner.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/components/HealthyBanner.tsx \
        src/modules/dashboard/components/HealthyBanner.test.tsx
git commit -m "feat(dashboard): HealthyBanner component"
```

---

## Task 7: AttentionQueue component

**Files:**
- Create: `src/modules/dashboard/components/AttentionQueue.tsx`
- Create: `src/modules/dashboard/components/AttentionQueue.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/AttentionQueue.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttentionQueue } from './AttentionQueue'
import type { Incident } from '../types'

const incidents: Incident[] = [
  {
    id: 'i1', severity: 'crit', pipelineName: 'orders-to-clickhouse',
    title: 'DLQ growing — schema mismatch on user_id',
    description: '412 events failed in the last hour.',
    meta: ['started 47m ago', '412 events'],
    ctaLabel: 'Fix it',
  },
  {
    id: 'i2', severity: 'warn', pipelineName: 'events-stream-prod',
    title: 'Schema drift detected',
    description: 'Source has added 2 new fields.',
    meta: ['detected 2h ago'],
    ctaLabel: 'Review drift',
  },
]

describe('AttentionQueue', () => {
  it('renders all incident rows', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(screen.getByText('DLQ growing — schema mismatch on user_id')).toBeInTheDocument()
    expect(screen.getByText('Schema drift detected')).toBeInTheDocument()
  })

  it('renders pipeline name tags', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(screen.getAllByText('orders-to-clickhouse')).toHaveLength(1)
  })

  it('renders CTA buttons', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(screen.getByRole('button', { name: 'Fix it' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review drift' })).toBeInTheDocument()
  })

  it('shows incident count in header', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(screen.getByText('2 incidents')).toBeInTheDocument()
  })

  it('shows "Sort by impact" label in incident state', () => {
    render(<AttentionQueue incidents={incidents} isIncidentState={true} />)
    expect(screen.getByText(/Sort by impact/)).toBeInTheDocument()
  })

  it('applies crit row class for critical incident', () => {
    const { container } = render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(container.querySelector('.attn-row.crit')).not.toBeNull()
  })

  it('applies warn row class for warning incident', () => {
    const { container } = render(<AttentionQueue incidents={incidents} isIncidentState={false} />)
    expect(container.querySelector('.attn-row.warn')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/AttentionQueue.test.tsx
```

- [ ] **Step 3: Create `src/modules/dashboard/components/AttentionQueue.tsx`**

```tsx
'use client'

import { AlertTriangleIcon, XCircleIcon, InfoIcon, GitBranchIcon } from 'lucide-react'
import type { Incident, IncidentSeverity } from '../types'

function SeverityIcon({ severity }: { severity: IncidentSeverity }) {
  if (severity === 'crit') return <XCircleIcon size={14} aria-hidden="true" />
  if (severity === 'warn') return <GitBranchIcon size={14} aria-hidden="true" />
  return <InfoIcon size={14} aria-hidden="true" />
}

type Props = {
  incidents: Incident[]
  isIncidentState: boolean
}

export function AttentionQueue({ incidents, isIncidentState }: Props) {
  const count = incidents.length
  return (
    <div className="dash-card">
      <div className="dash-card-h">
        <div>
          <h3>
            Needs your attention
            <span className="dash-count">{count} {count === 1 ? 'incident' : 'incidents'}</span>
          </h3>
        </div>
        <div>
          {isIncidentState ? (
            <button className="dash-link" type="button">Sort by impact ▾</button>
          ) : (
            <button className="dash-link" type="button">View all</button>
          )}
        </div>
      </div>
      <div className="attn-list">
        {incidents.map((incident) => (
          <div key={incident.id} className={`attn-row ${incident.severity}`}>
            <div className="attn-stripe" />
            <div className={`attn-icon`}>
              <SeverityIcon severity={incident.severity} />
            </div>
            <div className="attn-body">
              <div className="attn-title">
                <span className="attn-pipe">{incident.pipelineName}</span>
                {incident.title}
              </div>
              <div className="attn-desc">{incident.description}</div>
              <div className="attn-meta">
                {incident.meta.map((m, i) => (
                  <span key={i}>
                    {i > 0 && <span className="attn-meta-sep">·</span>}
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <button className="attn-cta" type="button" aria-label={incident.ctaLabel}>
              {incident.ctaLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/modules/dashboard/components/AttentionQueue.test.tsx
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/components/AttentionQueue.tsx \
        src/modules/dashboard/components/AttentionQueue.test.tsx
git commit -m "feat(dashboard): AttentionQueue component"
```

---

## Task 8: ThroughputChart component

**Files:**
- Create: `src/modules/dashboard/components/ThroughputChart.tsx`
- Create: `src/modules/dashboard/components/ThroughputChart.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/ThroughputChart.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThroughputChart } from './ThroughputChart'
import type { DashStats } from '../types'

const stats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 0, eventsPerSecDelta: 0,
  errorRate: 0, errorRateDelta: 0,
  dlqEvents: 0, dlqDelta: 0,
  avgLagMs: 0, avgLagMsDelta: 0,
  throughputIn: 153400000,
  throughputOut: 152800000,
  throughputLossPct: 0.39,
  throughputSeries: {
    in: Array.from({ length: 60 }, (_, i) => 720 + i),
    out: Array.from({ length: 60 }, (_, i) => 702 + i),
  },
}

describe('ThroughputChart', () => {
  it('renders card title "Throughput"', () => {
    render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(screen.getByText('Throughput')).toBeInTheDocument()
  })

  it('renders "Open in observability" link', () => {
    render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(screen.getByText(/Open in observability/)).toBeInTheDocument()
  })

  it('renders In totals label', () => {
    render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(screen.getByText(/In · last hour/i)).toBeInTheDocument()
  })

  it('renders Out totals label', () => {
    render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(screen.getByText(/Out · last hour/i)).toBeInTheDocument()
  })

  it('renders an SVG chart element', () => {
    const { container } = render(<ThroughputChart stats={stats} isIncidentState={false} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('shows "with incident overlay" in incident state', () => {
    render(<ThroughputChart stats={stats} isIncidentState={true} />)
    expect(screen.getByText(/with incident overlay/)).toBeInTheDocument()
  })

  it('applies loss-crit class when loss > 10%', () => {
    const { container } = render(<ThroughputChart stats={{ ...stats, throughputLossPct: 13.7 }} isIncidentState={false} />)
    expect(container.querySelector('.loss-crit')).not.toBeNull()
  })

  it('applies loss-warn class when loss > 1%', () => {
    const { container } = render(<ThroughputChart stats={{ ...stats, throughputLossPct: 2.5 }} isIncidentState={false} />)
    expect(container.querySelector('.loss-warn')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/ThroughputChart.test.tsx
```

- [ ] **Step 3: Create `src/modules/dashboard/components/ThroughputChart.tsx`**

```tsx
'use client'

import type { DashStats } from '../types'

function fmtM(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

type ChartProps = { inSeries: number[]; outSeries: number[] }

function SvgChart({ inSeries, outSeries }: ChartProps) {
  const w = 640, h = 130, pad = 8
  const all = [...inSeries, ...outSeries]
  if (all.length === 0) return null
  const max = Math.max(...all) * 1.1 || 1
  const N = inSeries.length
  const stepX = (w - pad * 2) / (N - 1)
  const yFor = (v: number) => h - pad - (v / max) * (h - pad * 2)
  const polyIn = inSeries.map((v, i) => `${pad + i * stepX},${yFor(v)}`).join(' ')
  const polyOut = outSeries.map((v, i) => `${pad + i * stepX},${yFor(v)}`).join(' ')
  const areaIn = `${pad},${h - pad} ${polyIn} ${pad + (N - 1) * stepX},${h - pad}`
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="thruGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-orange-300)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-orange-300)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1={pad} x2={w - pad}
          y1={pad + p * (h - pad * 2)} y2={pad + p * (h - pad * 2)}
          stroke="var(--color-gray-dark-800)" strokeDasharray="2 4" />
      ))}
      <polygon points={areaIn} fill="url(#thruGrad)" />
      <polyline points={polyIn} fill="none" stroke="var(--color-orange-300)" strokeWidth="1.5" />
      <polyline points={polyOut} fill="none" stroke="var(--color-blue-500)" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  )
}

type Props = { stats: DashStats; isIncidentState: boolean }

export function ThroughputChart({ stats, isIncidentState }: Props) {
  const lossCls = stats.throughputLossPct > 10 ? 'loss-crit' : stats.throughputLossPct > 1 ? 'loss-warn' : ''
  const title = isIncidentState ? 'Throughput · with incident overlay' : 'Throughput'
  return (
    <div className="dash-card thru-card">
      <div className="dash-card-h" style={{ padding: 0, marginBottom: 12, borderBottom: 'none' }}>
        <h3>{title}</h3>
        <a href="/observability" className="dash-link">Open in observability →</a>
      </div>
      <div className="thru-totals">
        <div className="thru-blk">
          <div className="thru-lbl">In · last hour</div>
          <div className="thru-val">{fmtM(stats.throughputIn)}<span className="thru-unit">events</span></div>
        </div>
        <div className="thru-blk">
          <div className="thru-lbl">Out · last hour</div>
          <div className="thru-val">{fmtM(stats.throughputOut)}<span className="thru-unit">events</span></div>
        </div>
        <div className="thru-blk">
          <div className="thru-lbl">Loss</div>
          <div className={`thru-val ${lossCls}`}>{stats.throughputLossPct.toFixed(2)}<span className="thru-unit">%</span></div>
        </div>
      </div>
      <SvgChart inSeries={stats.throughputSeries.in} outSeries={stats.throughputSeries.out} />
      <div className="thru-legend">
        <div><span className="thru-swatch" style={{ background: 'var(--color-orange-300)' }} />events in</div>
        <div><span className="thru-swatch" style={{ background: 'var(--color-blue-500)' }} />events written to ClickHouse</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/modules/dashboard/components/ThroughputChart.test.tsx
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/components/ThroughputChart.tsx \
        src/modules/dashboard/components/ThroughputChart.test.tsx
git commit -m "feat(dashboard): ThroughputChart component"
```

---

## Task 9: ActivityFeed component

**Files:**
- Create: `src/modules/dashboard/components/ActivityFeed.tsx`
- Create: `src/modules/dashboard/components/ActivityFeed.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/ActivityFeed.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityFeed } from './ActivityFeed'
import type { ActivityItem } from '../types'

const items: ActivityItem[] = [
  { kind: 'deploy', text: 'deployed orders-to-clickhouse v12', actor: 'maria.a', pipelineName: 'orders-to-clickhouse', relativeTime: '14m ago' },
  { kind: 'fail',   text: 'insert failed', pipelineName: 'stripe-payments-cdc', relativeTime: '2m' },
  { kind: 'pause',  text: 'paused test-events-staging', actor: 'vanessa.c', relativeTime: '5h ago' },
  { kind: 'info',   text: 'Schema orders.v4 drift detected', relativeTime: '2h ago' },
]

describe('ActivityFeed', () => {
  it('renders all activity rows', () => {
    render(<ActivityFeed items={items} />)
    expect(screen.getByText(/deployed orders-to-clickhouse v12/)).toBeInTheDocument()
    expect(screen.getByText(/insert failed/)).toBeInTheDocument()
  })

  it('renders relative timestamps', () => {
    render(<ActivityFeed items={items} />)
    expect(screen.getByText('14m ago')).toBeInTheDocument()
    expect(screen.getByText('2m')).toBeInTheDocument()
  })

  it('renders deploy dot for deploy events', () => {
    const { container } = render(<ActivityFeed items={[items[0]]} />)
    expect(container.querySelector('.activity-dot.deploy')).not.toBeNull()
  })

  it('renders fail dot for fail events', () => {
    const { container } = render(<ActivityFeed items={[items[1]]} />)
    expect(container.querySelector('.activity-dot.fail')).not.toBeNull()
  })

  it('renders pause dot for pause events', () => {
    const { container } = render(<ActivityFeed items={[items[2]]} />)
    expect(container.querySelector('.activity-dot.pause')).not.toBeNull()
  })

  it('renders info dot for info events', () => {
    const { container } = render(<ActivityFeed items={[items[3]]} />)
    expect(container.querySelector('.activity-dot.info')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/ActivityFeed.test.tsx
```

- [ ] **Step 3: Create `src/modules/dashboard/components/ActivityFeed.tsx`**

```tsx
'use client'

import type { ActivityItem } from '../types'

type Props = { items: ActivityItem[]; showViewLog?: boolean }

export function ActivityFeed({ items, showViewLog = true }: Props) {
  return (
    <div className="dash-card">
      <div className="dash-card-h">
        <h3>Recent activity</h3>
        {showViewLog && <button className="dash-link" type="button">View log →</button>}
      </div>
      <div className="activity-list">
        {items.map((item, idx) => (
          <div key={idx} className="activity-row">
            <span className={`activity-dot ${item.kind}`} aria-hidden="true" />
            <div className="activity-text">
              {item.actor && <b>{item.actor}</b>}{item.actor && ' '}
              {item.text}
            </div>
            <div className="activity-when">{item.relativeTime}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/modules/dashboard/components/ActivityFeed.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/components/ActivityFeed.tsx \
        src/modules/dashboard/components/ActivityFeed.test.tsx
git commit -m "feat(dashboard): ActivityFeed component"
```

---

## Task 10: PipelineTable component

**Files:**
- Create: `src/modules/dashboard/components/PipelineTable.tsx`
- Create: `src/modules/dashboard/components/PipelineTable.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/PipelineTable.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelineTable } from './PipelineTable'
import type { DashPipeline } from '../types'

const pipelines: DashPipeline[] = [
  { id: 'p1', name: 'orders-to-clickhouse', version: 'v12', sourceTopic: 'orders.events', destTable: 'analytics.orders', status: 'run',    statusLabel: 'running',  throughput: '8.4k', throughputUnit: '/s', lagP95: '420', lagUnit: 'ms', dlq: '0', lastDeploy: '2d ago', deployedBy: 'maria.a' },
  { id: 'p2', name: 'stripe-payments-cdc',  version: 'v6',  sourceTopic: 'stripe.cdc',    destTable: 'fin.payments',     status: 'paused', statusLabel: 'paused',   throughput: '—',    throughputUnit: '',   lagP95: '—',   lagUnit: '',   dlq: '—', lastDeploy: '3h ago', deployedBy: 'daniel.k' },
  { id: 'p3', name: 'broken-pipeline',      version: 'v1',  sourceTopic: 'src.topic',     destTable: 'dest.table',       status: 'fail',   statusLabel: 'failing',  throughput: '0',    throughputUnit: '/s', lagP95: '30',  lagUnit: 's',  dlq: '500', dlqSeverity: 'crit', lastDeploy: '1h ago', deployedBy: 'system' },
]

describe('PipelineTable', () => {
  it('renders all pipeline names', () => {
    render(<PipelineTable pipelines={pipelines} />)
    expect(screen.getByText('orders-to-clickhouse')).toBeInTheDocument()
    expect(screen.getByText('stripe-payments-cdc')).toBeInTheDocument()
    expect(screen.getByText('broken-pipeline')).toBeInTheDocument()
  })

  it('renders All filter chip as active by default', () => {
    const { container } = render(<PipelineTable pipelines={pipelines} />)
    const activeChip = container.querySelector('.dash-filter-chip.is-active')
    expect(activeChip?.textContent).toContain('All')
  })

  it('filters to running pipelines when Running chip clicked', () => {
    render(<PipelineTable pipelines={pipelines} />)
    fireEvent.click(screen.getByText(/^Running/))
    expect(screen.getByText('orders-to-clickhouse')).toBeInTheDocument()
    expect(screen.queryByText('stripe-payments-cdc')).not.toBeInTheDocument()
  })

  it('filters to paused pipelines when Paused chip clicked', () => {
    render(<PipelineTable pipelines={pipelines} />)
    fireEvent.click(screen.getByText(/^Paused/))
    expect(screen.getByText('stripe-payments-cdc')).toBeInTheDocument()
    expect(screen.queryByText('orders-to-clickhouse')).not.toBeInTheDocument()
  })

  it('shows run status chip with correct class', () => {
    const { container } = render(<PipelineTable pipelines={[pipelines[0]]} />)
    expect(container.querySelector('.status-chip.run')).not.toBeNull()
  })

  it('shows fail status chip with correct class', () => {
    const { container } = render(<PipelineTable pipelines={[pipelines[2]]} />)
    expect(container.querySelector('.status-chip.fail')).not.toBeNull()
  })

  it('applies crit class to DLQ cell when dlqSeverity is crit', () => {
    const { container } = render(<PipelineTable pipelines={[pipelines[2]]} />)
    expect(container.querySelector('.metric-cell.crit')).not.toBeNull()
  })

  it('shows version badge next to pipeline name', () => {
    render(<PipelineTable pipelines={[pipelines[0]]} />)
    expect(screen.getByText('v12')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/PipelineTable.test.tsx
```

- [ ] **Step 3: Create `src/modules/dashboard/components/PipelineTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { CanvasIcon, BarChartIcon, MoreHorizontalIcon } from 'lucide-react'
import type { DashPipeline, DashPipelineStatus } from '../types'

type FilterKey = 'all' | DashPipelineStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'run',    label: 'Running' },
  { key: 'deg',    label: 'Degraded' },
  { key: 'paused', label: 'Paused' },
  { key: 'draft',  label: 'Drafts' },
]

function StatusChip({ kind, label }: { kind: DashPipelineStatus; label: string }) {
  return (
    <span className={`status-chip ${kind}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  )
}

type RowProps = { pipeline: DashPipeline }

function PipelineRow({ pipeline: p }: RowProps) {
  return (
    <tr>
      <td>
        <div className="pipe-name">
          {p.name}
          <span className="pipe-ver">{p.version}</span>
        </div>
      </td>
      <td>
        <div className="pipe-route">
          {p.sourceTopic}
          <span className="pipe-arrow">→</span>
          {p.destTable}
        </div>
      </td>
      <td><StatusChip kind={p.status} label={p.statusLabel} /></td>
      <td className="r">
        <div className="metric-cell">{p.throughput}<span className="u">{p.throughputUnit}</span></div>
      </td>
      <td className="r">
        <div className={`metric-cell${p.lagSeverity ? ` ${p.lagSeverity}` : ''}`}>
          {p.lagP95}<span className="u">{p.lagUnit}</span>
        </div>
      </td>
      <td className="r">
        <div className={`metric-cell${p.dlqSeverity ? ` ${p.dlqSeverity}` : ''}`}>{p.dlq || '0'}</div>
      </td>
      <td>
        <div className="metric-cell" style={{ fontSize: 11.5 }}>
          {p.lastDeploy}
          <span className="sub">by {p.deployedBy}</span>
        </div>
      </td>
      <td className="r">
        <div className="row-actions">
          <button title="Open canvas" type="button"><CanvasIcon size={13} /></button>
          <button title="Metrics" type="button"><BarChartIcon size={13} /></button>
          <button title="More" type="button"><MoreHorizontalIcon size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

type Props = { pipelines: DashPipeline[] }

export function PipelineTable({ pipelines }: Props) {
  const [active, setActive] = useState<FilterKey>('all')

  const counts: Record<FilterKey, number> = {
    all:    pipelines.length,
    run:    pipelines.filter((p) => p.status === 'run').length,
    deg:    pipelines.filter((p) => p.status === 'deg').length,
    paused: pipelines.filter((p) => p.status === 'paused').length,
    draft:  pipelines.filter((p) => p.status === 'draft').length,
    fail:   pipelines.filter((p) => p.status === 'fail').length,
  }

  const visible = active === 'all' ? pipelines : pipelines.filter((p) => p.status === active)

  return (
    <div className="dash-table">
      <div className="dash-table-h">
        <h3>Pipelines</h3>
        <div className="dash-filters">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`dash-filter-chip${active === key ? ' is-active' : ''}`}
              onClick={() => setActive(key)}
            >
              {label}
              <span className="dash-filter-n">{counts[key]}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="dash-filter-chip" type="button">Sort: throughput ▾</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Pipeline</th>
            <th>Source → destination</th>
            <th>Status</th>
            <th className="r">Throughput</th>
            <th className="r">Lag · p95</th>
            <th className="r">DLQ</th>
            <th>Last deploy</th>
            <th className="r" />
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => <PipelineRow key={p.id} pipeline={p} />)}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/modules/dashboard/components/PipelineTable.test.tsx
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/components/PipelineTable.tsx \
        src/modules/dashboard/components/PipelineTable.test.tsx
git commit -m "feat(dashboard): PipelineTable with client-side filter chips"
```

---

## Task 11: DashFirstRun component

**Files:**
- Create: `src/modules/dashboard/components/DashFirstRun.tsx`
- Create: `src/modules/dashboard/components/DashFirstRun.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/DashFirstRun.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashFirstRun } from './DashFirstRun'

describe('DashFirstRun', () => {
  it('renders the main heading', () => {
    render(<DashFirstRun />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent("Let's set up your first pipeline")
  })

  it('renders all 6 action tiles by name', () => {
    render(<DashFirstRun />)
    expect(screen.getByText('Guided wizard')).toBeInTheDocument()
    expect(screen.getByText('From template')).toBeInTheDocument()
    expect(screen.getByText('Visual canvas')).toBeInTheDocument()
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Import config')).toBeInTheDocument()
    expect(screen.getByText('Try with sample data')).toBeInTheDocument()
  })

  it('marks "From template" and "Try with sample data" as disabled', () => {
    const { container } = render(<DashFirstRun />)
    const disabled = container.querySelectorAll('.empty-path.disabled')
    expect(disabled).toHaveLength(2)
    const names = Array.from(disabled).map((el) => el.querySelector('.empty-path-name')?.textContent)
    expect(names).toContain('From template')
    expect(names).toContain('Try with sample data')
  })

  it('active tiles are not marked disabled', () => {
    const { container } = render(<DashFirstRun />)
    const active = Array.from(container.querySelectorAll('.empty-path:not(.disabled)'))
    expect(active).toHaveLength(4)
  })

  it('Guided wizard tile links to /', () => {
    render(<DashFirstRun />)
    const link = screen.getByRole('link', { name: /Guided wizard/ })
    expect(link).toHaveAttribute('href', '/')
  })

  it('Ask AI tile links to /pipelines/create/ai', () => {
    render(<DashFirstRun />)
    const link = screen.getByRole('link', { name: /Ask AI/ })
    expect(link).toHaveAttribute('href', '/pipelines/create/ai')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/DashFirstRun.test.tsx
```

- [ ] **Step 3: Create `src/modules/dashboard/components/DashFirstRun.tsx`**

```tsx
'use client'

import { WorkflowIcon, LayoutTemplateIcon, NetworkIcon, SparklesIcon, UploadIcon, FlaskConicalIcon } from 'lucide-react'

type PathDef = {
  icon: React.ReactNode
  name: string
  description: string
  href?: string
  disabled?: boolean
}

const PATHS: PathDef[] = [
  {
    icon: <WorkflowIcon size={14} />,
    name: 'Guided wizard',
    description: 'Step-by-step · ~3 min',
    href: '/',
  },
  {
    icon: <LayoutTemplateIcon size={14} />,
    name: 'From template',
    description: 'Kafka → ClickHouse, OTLP logs & more',
    disabled: true,
  },
  {
    icon: <NetworkIcon size={14} />,
    name: 'Visual canvas',
    description: 'Drag-and-connect · advanced',
    href: '/canvas',
  },
  {
    icon: <SparklesIcon size={14} />,
    name: 'Ask AI',
    description: 'Describe it · we draft for you',
    href: '/pipelines/create/ai',
  },
  {
    icon: <UploadIcon size={14} />,
    name: 'Import config',
    description: 'Paste YAML / JSON',
    href: '/',
  },
  {
    icon: <FlaskConicalIcon size={14} />,
    name: 'Try with sample data',
    description: 'No setup · explore the UI',
    disabled: true,
  },
]

function PathTile({ path }: { path: PathDef }) {
  const cls = `empty-path${path.disabled ? ' disabled' : ''}`
  const inner = (
    <>
      <div className="empty-ic-wrap" aria-hidden="true">{path.icon}</div>
      <div className="empty-path-name">{path.name}</div>
      <div className="empty-path-desc">{path.description}</div>
    </>
  )
  if (path.disabled) {
    return <div className={cls} aria-disabled="true">{inner}</div>
  }
  return (
    <a href={path.href} className={cls} aria-label={path.name}>
      {inner}
    </a>
  )
}

export function DashFirstRun() {
  return (
    <div className="empty-state">
      <div className="empty-card">
        <div className="empty-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3-8 4 16 3-8h4" />
          </svg>
        </div>
        <h2>Let&apos;s set up your first pipeline</h2>
        <p>
          Pick the path that fits how you work. You can always switch — every path produces the same
          draft, which you&apos;ll review before deploying.
        </p>
        <div className="empty-paths">
          {PATHS.map((path) => <PathTile key={path.name} path={path} />)}
        </div>
        <div className="empty-foot">
          New to GlassFlow?{' '}
          <a href="#">Read the 5-minute intro</a>
          {' · '}
          <a href="#">Browse examples</a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/modules/dashboard/components/DashFirstRun.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/components/DashFirstRun.tsx \
        src/modules/dashboard/components/DashFirstRun.test.tsx
git commit -m "feat(dashboard): DashFirstRun component — 6-path grid, 2 disabled"
```

---

## Task 12: DashboardPage orchestrator

**Files:**
- Create: `src/modules/dashboard/components/DashboardPage.tsx`
- Create: `src/modules/dashboard/components/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/modules/dashboard/components/DashboardPage.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardPage } from './DashboardPage'
import type { DashboardState, DashStats, ActivityItem } from '../types'

const stats: DashStats = {
  activePipelines: 14, totalPipelines: 16,
  eventsPerSec: 42600, eventsPerSecDelta: 8.2,
  errorRate: 0.34, errorRateDelta: 0.21,
  dlqEvents: 2847, dlqDelta: 412,
  avgLagMs: 1200, avgLagMsDelta: 0,
  throughputIn: 153400000, throughputOut: 152800000, throughputLossPct: 0.39,
  throughputSeries: { in: Array(60).fill(720), out: Array(60).fill(702) },
}
const activity: ActivityItem[] = []
const pipeline = {
  id: 'p1', name: 'orders', version: 'v12', sourceTopic: 'src', destTable: 'dest',
  status: 'run' as const, statusLabel: 'running',
  throughput: '8k', throughputUnit: '/s', lagP95: '420', lagUnit: 'ms',
  dlq: '0', lastDeploy: '2d ago', deployedBy: 'alice',
}

describe('DashboardPage', () => {
  it('renders first-run state', () => {
    const state: DashboardState = { kind: 'first-run' }
    render(<DashboardPage state={state} />)
    expect(screen.getByText("Let's set up your first pipeline")).toBeInTheDocument()
  })

  it('renders "Welcome to GlassFlow" heading in first-run', () => {
    const state: DashboardState = { kind: 'first-run' }
    render(<DashboardPage state={state} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to GlassFlow')
  })

  it('renders healthy banner in healthy state', () => {
    const state: DashboardState = { kind: 'healthy', pipelines: [pipeline], stats, activity }
    render(<DashboardPage state={state} />)
    expect(screen.getByText('All pipelines healthy')).toBeInTheDocument()
  })

  it('renders KPI strip in healthy state', () => {
    const state: DashboardState = { kind: 'healthy', pipelines: [pipeline], stats, activity }
    render(<DashboardPage state={state} />)
    expect(screen.getByText(/Active pipelines/i)).toBeInTheDocument()
  })

  it('renders attention queue in populated state', () => {
    const state: DashboardState = {
      kind: 'populated', pipelines: [pipeline], stats, activity,
      incidents: [{
        id: 'i1', severity: 'crit', pipelineName: 'orders', title: 'DLQ growing',
        description: 'desc', meta: ['47m ago'], ctaLabel: 'Fix it',
      }],
    }
    render(<DashboardPage state={state} />)
    expect(screen.getByText('Needs your attention')).toBeInTheDocument()
    expect(screen.getByText('DLQ growing')).toBeInTheDocument()
  })

  it('renders pipeline table in populated state', () => {
    const state: DashboardState = {
      kind: 'populated', pipelines: [pipeline], stats, activity,
      incidents: [{ id: 'i1', severity: 'crit', pipelineName: 'orders', title: 'x', description: 'y', meta: [], ctaLabel: 'Fix' }],
    }
    render(<DashboardPage state={state} />)
    expect(screen.getByText('Pipelines')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
  })

  it('renders throughput chart in incident state', () => {
    const state: DashboardState = {
      kind: 'incident', pipelines: [pipeline], stats, activity, incidents: [],
    }
    render(<DashboardPage state={state} />)
    expect(screen.getByText(/Throughput/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test:run src/modules/dashboard/components/DashboardPage.test.tsx
```

- [ ] **Step 3: Create `src/modules/dashboard/components/DashboardPage.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { DashboardState } from '../types'
import { DashHeader } from './DashHeader'
import { KpiStrip } from './KpiStrip'
import { HealthyBanner } from './HealthyBanner'
import { AttentionQueue } from './AttentionQueue'
import { ThroughputChart } from './ThroughputChart'
import { ActivityFeed } from './ActivityFeed'
import { PipelineTable } from './PipelineTable'
import { DashFirstRun } from './DashFirstRun'

type Props = { state: DashboardState }

export function DashboardPage({ state }: Props) {
  const [env, setEnv] = useState('production')
  const [range, setRange] = useState('last 1h')

  return (
    <div className="dash-page">
      <DashHeader state={state} env={env} range={range} onEnvChange={setEnv} onRangeChange={setRange} />

      {state.kind === 'first-run' && <DashFirstRun />}

      {state.kind === 'healthy' && (
        <>
          <HealthyBanner lastIncident="4d 12h ago" />
          <KpiStrip stats={state.stats} />
          <div className="dash-main healthy-layout">
            <ThroughputChart stats={state.stats} isIncidentState={false} />
            <ActivityFeed items={state.activity} />
          </div>
          <PipelineTable pipelines={state.pipelines} />
        </>
      )}

      {(state.kind === 'populated' || state.kind === 'incident') && (
        <>
          <KpiStrip stats={state.stats} />
          <div className="dash-main">
            <AttentionQueue incidents={state.incidents} isIncidentState={state.kind === 'incident'} />
            <div className="side-stack">
              <ThroughputChart stats={state.stats} isIncidentState={state.kind === 'incident'} />
              <ActivityFeed items={state.activity} showViewLog={state.kind !== 'incident'} />
            </div>
          </div>
          <PipelineTable pipelines={state.pipelines} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm test:run src/modules/dashboard/components/DashboardPage.test.tsx
```

Expected: 7 tests pass.

- [ ] **Step 5: Run full dashboard test suite**

```bash
pnpm test:run src/modules/dashboard/
```

Expected: all tests pass across all dashboard files.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dashboard/components/DashboardPage.tsx \
        src/modules/dashboard/components/DashboardPage.test.tsx
git commit -m "feat(dashboard): DashboardPage — state-based layout orchestrator"
```

---

## Task 13: Wire up page.tsx and DashboardClient.tsx

**Files:**
- Modify: `src/app/(shell)/dashboard/page.tsx`
- Modify: `src/app/(shell)/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Rewrite `src/app/(shell)/dashboard/page.tsx`**

Replace the entire file with:

```tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getSessionSafely } from '@/src/lib/auth0'
import { isAuthEnabled } from '@/src/utils/auth-config.server'
import { getApiUrl } from '@/src/utils/mock-api'
import { determineDashboardState } from '@/src/modules/dashboard/types'
import type { DashPipeline, DashStats, Incident, ActivityItem } from '@/src/modules/dashboard/types'
import { DashboardClient } from './DashboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function fetchDashboardStats(scenario: string | null): Promise<{
  stats: DashStats
  incidents: Incident[]
  activity: ActivityItem[]
}> {
  try {
    const qs = scenario ? `?scenario=${scenario}` : ''
    const res = await fetch(getApiUrl(`dashboard/stats${qs}`), { cache: 'no-store' })
    if (!res.ok) throw new Error('stats fetch failed')
    return await res.json()
  } catch {
    return {
      stats: {
        activePipelines: 0, totalPipelines: 0,
        eventsPerSec: 0, eventsPerSecDelta: 0,
        errorRate: 0, errorRateDelta: 0,
        dlqEvents: 0, dlqDelta: 0,
        avgLagMs: 0, avgLagMsDelta: 0,
        throughputIn: 0, throughputOut: 0, throughputLossPct: 0,
        throughputSeries: { in: [], out: [] },
      },
      incidents: [],
      activity: [],
    }
  }
}

async function fetchDashboardPipelines(scenario: string | null): Promise<DashPipeline[]> {
  try {
    const qs = scenario ? `?scenario=${scenario}` : ''
    const res = await fetch(getApiUrl(`dashboard/pipelines${qs}`), { cache: 'no-store' })
    if (!res.ok) throw new Error('pipelines fetch failed')
    const data = await res.json()
    return data.pipelines ?? []
  } catch {
    return []
  }
}

type Props = { searchParams?: Promise<Record<string, string>> }

export default async function DashboardPage({ searchParams }: Props) {
  const authEnabled = isAuthEnabled()
  if (authEnabled) {
    const session = await getSessionSafely()
    if (!session?.user) redirect('/')
  }

  const params = await (searchParams ?? Promise.resolve({}))
  const scenario = params.scenario ?? null

  const [{ stats, incidents, activity }, pipelines] = await Promise.all([
    fetchDashboardStats(scenario),
    fetchDashboardPipelines(scenario),
  ])

  const state = determineDashboardState(pipelines, incidents, stats, activity)

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--color-foreground-primary)]" />
          <p className="body-3 text-[var(--color-foreground-neutral-faded)]">Loading dashboard…</p>
        </div>
      }
    >
      <DashboardClient state={state} />
    </Suspense>
  )
}
```

- [ ] **Step 2: Rewrite `src/app/(shell)/dashboard/DashboardClient.tsx`**

Replace the entire file with:

```tsx
'use client'

import { DashboardPage } from '@/src/modules/dashboard/components/DashboardPage'
import type { DashboardState } from '@/src/modules/dashboard/types'

type Props = { state: DashboardState }

export function DashboardClient({ state }: Props) {
  return <DashboardPage state={state} />
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Step 4: Start dev server and verify each state loads**

```bash
NEXT_PUBLIC_USE_MOCK_API=true pnpm dev
```

Open in browser:
- `http://localhost:3000/dashboard` → populated state (default)
- `http://localhost:3000/dashboard?scenario=healthy` → green banner, no incidents
- `http://localhost:3000/dashboard?scenario=incident` → red header, 6 incidents
- `http://localhost:3000/dashboard?scenario=empty` → first-run (no pipelines returned — seed returns populated, so first-run only appears with real empty backend or by modifying seed temporarily)

To manually test first-run: in `src/app/ui-api/mock/dashboard/pipelines/route.ts`, temporarily return `{ pipelines: [] }`, verify first-run renders, then revert.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(shell)/dashboard/page.tsx" \
        "src/app/(shell)/dashboard/DashboardClient.tsx"
git commit -m "feat(dashboard): wire server component — fetch stats/pipelines, compute state"
```

---

## Task 14: Routing changes

**Files:**
- Modify: `src/app/(main)/page.tsx`
- Modify: `src/app/(shell)/home/page.tsx`

- [ ] **Step 1: Update `src/app/(main)/page.tsx`**

Change every `redirect('/pipelines')` to `redirect('/dashboard')` and every `redirect('/home')` to `redirect('/dashboard')`.

The two occurrences are in the `!authEnabled` branch and the `user` branch:

```tsx
  // auth disabled
  if (!authEnabled) {
    const hasPipelines = await checkPipelines()
    if (hasPipelines) redirect('/dashboard')   // was /pipelines
    redirect('/dashboard')                     // was /home
  }

  // auth enabled, logged in
  const [session, hasPipelines] = await Promise.all([getSessionSafely(), checkPipelines()])
  ...
  if (user) {
    if (hasPipelines) redirect('/dashboard')   // was /pipelines
    redirect('/dashboard')                     // was /home
  }
```

- [ ] **Step 2: Update `src/app/(shell)/home/page.tsx`**

Add a redirect at the top of the server component, before any other logic:

```tsx
import { redirect } from 'next/navigation'

export default async function HomePage() {
  redirect('/dashboard')
}
```

Remove all other content from the file — the auth check, the `HomePageClient` render, everything. The home page is now a permanent redirect.

- [ ] **Step 3: Verify in browser**

With `NEXT_PUBLIC_USE_MOCK_API=true pnpm dev`:

1. Navigate to `http://localhost:3000/` → should land on `/dashboard`
2. Navigate to `http://localhost:3000/home` → should redirect to `/dashboard`
3. Confirm `AppTopbar` "Dashboard" nav item is active

- [ ] **Step 4: Commit**

```bash
git add "src/app/(main)/page.tsx" "src/app/(shell)/home/page.tsx"
git commit -m "feat(dashboard): redirect / and /home to /dashboard"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| 4 dashboard states | Task 2 (types), Task 12 (DashboardPage) |
| First-run: 6-tile grid, 2 disabled | Task 11 |
| No personal greeting | Task 4 (DashHeader) |
| "Welcome to GlassFlow" stays | Task 4 |
| Routing: / and /home → /dashboard | Task 14 |
| KPI strip (5 cards, severity, sparklines) | Task 5 |
| Attention queue (incidents, stripe, CTA) | Task 7 |
| Healthy banner | Task 6 |
| Throughput chart (SVG, totals, legend) | Task 8 |
| Activity feed (dot colors, timestamps) | Task 9 |
| Pipeline table (filter chips, status chips) | Task 10 |
| Mock API routes (2 endpoints, 3 scenarios) | Task 3 |
| CSS tokens (3 new surface tokens) | Task 1 |
| `getApiUrl()` mock/real switching | Task 13 |
| `NEXT_PUBLIC_USE_MOCK_API` flag | Task 13 |

All spec requirements are covered. No gaps found.

**Type consistency check:**

- `DashboardState` defined in Task 2, consumed in Tasks 4, 5, 12, 13 — consistent discriminated union
- `DashStats` defined in Task 2, consumed by `KpiStrip` (Task 5), `ThroughputChart` (Task 8), `DashboardPage` (Task 12) — same shape throughout
- `Incident` defined in Task 2, consumed by `AttentionQueue` (Task 7) and seed data (Task 3) — consistent
- `ActivityItem` defined in Task 2, consumed by `ActivityFeed` (Task 9) — consistent
- `DashPipeline.status` typed as `'run' | 'deg' | 'fail' | 'paused' | 'draft'` in Task 2; `FilterKey` in `PipelineTable` (Task 10) uses the same union — consistent
- `PipelineTable` uses `CanvasIcon` and `BarChartIcon` from lucide-react — verify these icon names exist in the installed version before running; if not found, substitute `SquareIcon` and `ActivityIcon`
