# Design System Audit — 2026-05-12

> **Frozen snapshot.** Do not edit. Active work tracked in `docs/DESIGN_SYSTEM_CONSOLIDATION_PLAN.md`.
>
> **Audit performed:** 2026-05-12 | **Branch:** `ui-ux-revamp-2.0`
>
> **Scope:** Token layer (`src/themes/base.css`, `src/themes/theme.css`, `src/app/globals.css`),
> primitive layer (`src/components/ui/*`), showcase (`src/app/(main)/dev/components/**`),
> and the three consolidated feature surfaces — **Dashboard** (`src/app/(shell)/dashboard/`),
> **Pipelines** (`src/app/(shell)/pipelines/`), **Library** (`src/app/(shell)/library/`).
>
> **Companion docs:** `docs/GALLERY_AUDIT_2026-05-08.md` (gallery-only),
> `docs/architecture/DESIGN_SYSTEM.md` (token system reference).

---

## Health Score

| Layer | Score | Verdict |
|---|---|---|
| Tokens (`base.css` + `theme.css`) | **5/5** | Mature, semantic, well-aliased, single source of truth. |
| Primitives (`src/components/ui/*`) | **4.5/5** | Solid CVA-based variants; minor gaps in `Select`/`Input`/`Table`. |
| Dev showcase (`/dev/components`) | **4.75/5** | Production-grade reference. 33/35 primitives covered. |
| Feature pages (dashboard / pipelines / library) | **2/5** | Three siblings raised by different parents. |
| **Composite** | **3.75/5** | Foundation strong, governance weak. |

**Headline finding:** an **excellent foundation** (tokens + primitives + showcase) is **inconsistently consumed** by feature pages. The bottleneck is now governance, not foundation.

---

## Layer 1 — Tokens

### What's working

- Two-file split: raw values in `base.css`, semantic aliases in `theme.css`.
- Semantic role families: `--color-{background|border|foreground}-{primary|critical|warning|positive|neutral|info|disabled|regular}` — design-system-grade naming, not ad-hoc palette.
- Component-scoped token blocks (`--button-*`, `--card-*`, `--chip-*`, `--control-*`, `--surface-*`, `--option-*`) — primitives consume these aliases, not the raw palette. Correct level of indirection.
- Feedback aliases (`--surface-bg`, `--control-bg`, `--option-bg`, `--badge-success-bg`) consistent — `--card-bg: var(--surface-bg)` enables re-skin without touching components.
- Figma sync metadata built in (`src/themes/tokens-external-design-kit.json`, `pnpm sync-tokens`).

### Issues found

| Severity | Location | Issue |
|---|---|---|
| Low | `theme.css:483–484` vs `base.css:119–122` | `--color-orange-alpha-10/20` redefined in `theme.css` with different orange (`#e89159` vs `#ffa24b`). Silent override. Pick one, delete the other. |
| Low | Missing tokens | No `--color-red-alpha-5` / `--color-red-alpha-7` / `--color-orange-alpha-5`. Causes the rgba violation below. |

---

## Layer 2 — Primitives

### Strong (CVA-typed variants)

| Primitive | Variants | Token wiring |
|---|---|---|
| `button.tsx` | 12 variants × 6 sizes + `loading` | Full: `--button-primary-gradient-*`, `--shadow-pressed`, `--button-*-text` |
| `badge.tsx` | 7 variants (`default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `error`) | Full: `--color-background-neutral`, `--color-foreground-positive-faded` |
| `card.tsx` | 9 variants (`default`, `dark`, `outline`, `elevated`, `elevatedSubtle`, `regular`, `feedback`, `content`, `selectable`) + state modifiers (`card-dark-selected`, `card-dark-error`, `card-outline-selected`, `card-outline-error`) | Delegates to `.card-*` CSS classes that consume tokens cleanly |
| `pill.tsx`, `scope-badge.tsx`, `live-indicator.tsx`, `sparkline.tsx`, `empty-state.tsx`, `crumbs.tsx`, `kbd-hint.tsx` | Production-grade utilities | Full token wiring |

### Weak (no CVA, class-based)

| Primitive | Gap | Risk |
|---|---|---|
| `select.tsx` | No `cva()`. Size variants only on `SelectTrigger` (`sm`, `default`). Visual state via Radix data attributes + CSS. | Consumers reach for `className` — type safety lost. |
| `input.tsx` | No `cva()`. Delegates to `input-regular`, `input-border-regular`, `input-border-error` CSS classes. | CLAUDE.md §4 bans direct class use, but enforcement is convention-only. CVA would make it type-enforced. |
| `table.tsx` | Composable Radix-style only. No variant API. Visual state delegated to `.pipelines-table`, `.library-table`, `.notifications-table-row` globals. | This is the root of the three-table-system problem (see Layer 4). |
| `dialog.tsx`, `drawer.tsx`, `popover.tsx`, `sheet.tsx`, `tabs.tsx` | No CVA. Single style. | Acceptable — single-skin overlays don't need variants. |

### Showcase coverage

- 33 of 35 primitives showcased with variants, sizes, states, code snippets.
- Missing: `form.tsx`, `sonner.tsx` (both support utilities — low impact).
- **Zero token violations** in showcase code — every example uses `var(--token)`.

---

## Layer 3 — Dev Showcase (`/dev/components`)

### Structure

```
/dev/components            — overview index with sidebar nav
  /foundations             — typography, semantic colors, surfaces, shadows, spacing, z-index
  /buttons                 — 11 variants × 7 sizes + loading + icon combinations
  /display                 — Cards (9 variants + 4 state modifiers), Badges (7), Avatars, Tables
  /forms                   — Input (5 states), Select, Checkbox, Switch, Textarea, InputGroup, SearchableSelect, DualSearchableSelect
  /overlays                — Dialog, Tooltip, Popover, Dropdown, Calendar, Command palette
  /navigation              — Tabs, Accordion
  /feedback                — Alert (4 variants), Toast trigger, 14 animation utility classes
  /utilities               — Skeleton, EmptyState, Pill, Sparkline, LiveIndicator, KbdHint, Crumbs, ScopeBadge, TimeRangePicker
  /drawers                 — Drawer, Sheet, ConfirmationModal, InfoModal patterns
```

### Strengths

- Sticky `GalleryNav` sidebar, labeled `Section` / `VariantGrid` / `Preview` helper components.
- `CodeBlock` shows canonical usage per pattern.
- Foundations page is a true reference — documents every type scale, semantic color pair, surface token.
- Disabled / error / loading states explicitly demonstrated.

### Gaps

| Gap | Impact |
|---|---|
| No full-text / Cmd-K search | At 10 pages, search starts paying off. |
| No "composite patterns" page | Card + Table inside (the "data card" rebuilt 3× in feature pages), EmptyState inside Card, Table loading state, Pagination + Table. |
| No anti-pattern examples | Showing what *not* to do (e.g., the `AttentionQueue.tsx` rgba violation) would be educational. |

---

## Layer 4 — Feature Pages (the weakest layer)

### Per-surface inventory

| Concern | Dashboard | Pipelines | Library |
|---|---|---|---|
| UI primitives imported | **None** | Button + Badge | Button, Badge, Card, Input, Crumbs, Skeleton, Pill, EmptyState (8) |
| Table implementation | Custom CSS-grid (`PipelineTable.tsx`, `COLS = '2fr 2.5fr 1.2fr ...'`) | `PipelinesTable` generic + `.pipelines-table` flat-row variant | `.library-table` flat-row variant (similar but separate) |
| Page shell | Custom `<div className="min-h-full flex flex-col">` | `container mx-auto p-4` (generic Tailwind) | `.lib-page` + sidebar layout (`.lib-layout`) |
| Header pattern | `DashHeader` (`px-10 pt-7 pb-6` hardcoded) | Inline toolbar | `.lib-header` CSS class |
| Breadcrumbs | None | None | `<Crumbs>` (primitive used) |
| Padding scale | Hardcoded px (`10`, `18`) | `container mx-auto p-4` | Mix of `--unit-x4/x5` + hardcoded |
| Empty state | Inline `HealthyBanner`, `DashFirstRun` | Custom `PipelinesEmptyState` | `<EmptyState>` primitive |

### Three problems compound

#### Problem 1 — Three table systems

`.pipelines-table` (Pipelines), `.library-table` (Library), and `PipelineTable.tsx` custom-grid (Dashboard) were each refactored to flat-row dense layouts in **separate sessions** (see memory: `pipelines-table-style` 11:23–11:52, `library-table-refactor` 15:30, `dashboard-styling-token-refactor` 14:44–16:30). The patterns converged but were never **unified** into a single primitive. Parallel evolutionary lineages.

#### Problem 2 — No shared page shell

Each surface invents its own header, padding, max-width, breadcrumb decision. A new feature has to choose one — or invent a fourth. This is how the parallel-lineage problem keeps reproducing.

#### Problem 3 — Token violation (only one found, but symptomatic)

```tsx
// src/modules/dashboard/components/AttentionQueue.tsx:59
'bg-[rgba(226,44,44,0.05)] hover:bg-[rgba(226,44,44,0.07)]'
```

Symptom of missing `--color-red-alpha-5/7` tokens in the palette (red has only `alpha-40`).

### Token discipline across feature pages

Outside the one violation above, all three pages consume tokens correctly via `var(--token)` or component CSS classes. Token discipline at the **feature level** is ~95%+ clean. The fragmentation problem is **pattern duplication**, not token leakage.

---

## Cross-cutting findings

### Three-layer model verdict

| Layer | Status |
|---|---|
| **A. Tokens** (`base.css` → `theme.css`) | Clean, well-organized. |
| **B. Primitives** (`src/components/ui/*` + `src/app/styles/components/*.css`) | Strong CVA primitives; CSS files consume tokens cleanly; no hex/rgba in CSS files. |
| **C. Feature CSS** (`src/app/styles/library.css`, page-scoped overrides) | Acceptable — layers *on top* of primitives (`.library-table .table-row:hover`) rather than replacing them. Not abused as escape hatch. |

The model is sound. The weak point isn't the layering — it's that **feature surfaces build directly against tokens and CSS classes instead of going through primitives**.

### Convention vs. enforcement

Several rules in `CLAUDE.md` are convention-only (no lint enforcement):

- §1 — "Never hardcode colors" → no eslint rule banning `#[0-9a-f]{3,6}` or `rgba(` in `*.tsx`
- §2 — "Always use variant props, never raw CSS class names" → no rule banning `card-dark`, `btn-primary` className strings outside primitives
- §4 — Internal CSS classes (`input-regular`, `btn-card`) marked as "don't use directly" → no rule enforcing this

Convention has worked so far because the team is small. As the team grows or AI agents contribute more code, convention drift is the most likely failure mode.

---

## Detailed file-level findings (reference)

### Tokens

- `base.css:112–122` — Orange brand palette + alpha variants. Source of truth.
- `theme.css:483–484` — **Bug:** redefines `--color-orange-alpha-10/20` after import with different orange.
- `theme.css:7–106` — Semantic role aliases (primary, critical, warning, positive, neutral, info, regular, disabled). Excellent.
- `theme.css:156–197` — Control + Surface token groups. Excellent abstraction.
- `theme.css:289–347` — Card variant tokens (warm/cool/error/selected gradient borders). Good but verbose.
- `theme.css:454–481` — Observability-specific tokens (`--obs-chart-*`, `--obs-severity-*`, `--obs-retention-*`). Domain-scoped — appropriate.

### Primitives

- `button.tsx` — CVA. 12 variants. Strong.
- `badge.tsx` — CVA. 7 variants. Strong.
- `card.tsx` — Manual variant map → CSS class. 9 variants. Strong.
- `input.tsx` — No CVA. Delegates to CSS. Weak.
- `select.tsx` — Radix wrapper. No CVA. Weak.
- `table.tsx` — Composable. No variant API. Weak (root of Problem 1 above).

### Feature pages

- `src/app/(shell)/dashboard/` — Zero primitive imports. Custom grid table, custom header, custom padding.
- `src/app/(shell)/pipelines/` — Button + Badge only. `PipelinesTable` is a generic component using shared `.table-container` + `.pipelines-table` variant.
- `src/app/(shell)/library/` — 8 primitive imports (highest reuse). Uses `<Crumbs>`, `<EmptyState>`, etc. Custom `.library-table`.

---

## Recommendations (executive summary)

See `docs/DESIGN_SYSTEM_CONSOLIDATION_PLAN.md` for the actionable plan with task breakdown and acceptance criteria.

Three governance moves, in priority order:

1. **`<DataTable>` primitive** — promote the convergent flat-table pattern into `src/components/ui/`. Migrate all three surfaces.
2. **`<PageShell>` / `<PageHeader>` / `<PageBreadcrumbs>`** — shared layout scaffolding in `src/components/shared/`. Bake in max-width, padding, header layout, optional sidebar slot.
3. **Lint enforcement** — ban inline `rgba(` and `#[0-9a-f]{3,6}` in `*.tsx`/`*.ts` outside `src/themes/` and `src/components/ui/*.figma.tsx`. Add missing alpha tokens (`--color-red-alpha-5/7`, `--color-orange-alpha-5`).

Plus minor cleanups (typed in detail in the plan):

- Resolve `--color-orange-alpha-10/20` double-definition.
- Add CVA to `Select` and `Input` so variants are type-enforced.
- Add `form.tsx` and `sonner.tsx` to `/dev/components`.
- Fix `AttentionQueue.tsx:59` rgba violation.

---

## Sign-off

**Auditor:** Claude Opus 4.7 (1M context), session 2026-05-12.

**Audit method:** Three parallel exploration agents (Explore subagent) covering showcase / feature pages / primitive layer. Findings cross-verified against `CLAUDE.md`, `docs/architecture/DESIGN_SYSTEM.md`, and the actual CSS / TSX source files.

**Verdict:** The design system is **ready to be the basis for further development** — but only if the three governance moves are completed *before* new feature work scales the inconsistency.
