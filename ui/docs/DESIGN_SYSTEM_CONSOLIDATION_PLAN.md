# Design System Consolidation Plan

> **Living document.** Update task status as work progresses.
>
> **Source:** Findings from `docs/DESIGN_SYSTEM_AUDIT_2026-05-12.md`.
> Read the audit first if you need the *why*; this doc is the *what* and *how*.
>
> **Goal:** Close the gap between a strong design system foundation and three fragmented feature surfaces (Dashboard, Pipelines, Library) **before** scaling to new features.
>
> **Branch suggestion:** `design-system-consolidation` off `ui-ux-revamp-2.0`.

---

## Why this plan exists

Three sessions of independent refactor work (memory entries: `pipelines-table-style`, `library-table-refactor`, `dashboard-styling-token-refactor`) converged on similar flat-table, token-driven patterns — but each surface implemented its own. The audit found:

- 3 separate table systems
- 3 separate page-shell patterns
- 0 shared header / breadcrumb component
- 1 token violation that exists because of missing alpha tokens
- Several CLAUDE.md rules enforced only by convention

The fix is **extraction** of the convergent patterns into shared primitives, **rebuild** of the three surfaces on top of them, and **lint enforcement** so drift cannot reproduce.

---

## Sequencing principle

Do these in order. Each task removes a cause that would force the next task to be redone.

```
1. Tokens     →  fix the alpha-token gap (unblocks task 5 lint rule)
2. Primitives →  CVA-ify Input/Select, add form/sonner to showcase
3. <DataTable> →  extract the convergent flat-table pattern
4. <PageShell> →  extract the page header / breadcrumb / padding scaffolding
5. Lint rules  →  prevent drift after the foundation is consolidated
6. Migrate    →  rebuild Dashboard / Pipelines / Library on the new primitives
7. Polish     →  composite-pattern showcase pages + anti-pattern examples
```

---

## Phase 1 — Token cleanup

**Goal:** Remove the contradictions and gaps that block lint enforcement and that caused the one violation found in the audit.

### Task 1.1 — Resolve `--color-orange-alpha-10/20` double-definition

- **Files:** `src/themes/base.css:119–122`, `src/themes/theme.css:483–484`.
- **Problem:** `theme.css` redefines these with a different orange (`#e89159` vs the brand `#ffa24b`).
- **Action:** Delete the redefinition in `theme.css`. Keep `base.css` as source of truth.
- **Acceptance:** `rg "color-orange-alpha-(10|20):" src/themes/` returns one match each.
- **Risk:** Low. Check any component that uses these tokens for visual regression (selection backgrounds, scope-badge backgrounds).

### Task 1.2 — Add missing alpha tokens

- **File:** `src/themes/base.css` (under `Red/Critical Colors` and `Primary Colors`).
- **Action:** Add:
  ```css
  --color-red-alpha-5: rgba(226, 44, 44, 0.05);
  --color-red-alpha-7: rgba(226, 44, 44, 0.07);
  --color-orange-alpha-5: rgba(255, 162, 75, 0.05);
  ```
- **Acceptance:** Tokens defined. Reused in `theme.css` if a semantic alias makes sense (e.g., `--row-tint-critical: var(--color-red-alpha-5)`).

### Task 1.3 — Fix `AttentionQueue.tsx:59`

- **File:** `src/modules/dashboard/components/AttentionQueue.tsx:59`.
- **Before:** `'bg-[rgba(226,44,44,0.05)] hover:bg-[rgba(226,44,44,0.07)]'`
- **After:** `'bg-[var(--color-red-alpha-5)] hover:bg-[var(--color-red-alpha-7)]'`
- **Acceptance:** `rg "rgba\(" src/modules/` returns 0 results in TSX files.

### Task 1.4 — Run token sync

- **Command:** `FIGMA_ACCESS_TOKEN=… FIGMA_FILE_KEY=sQIwmZ7augm8itFG6UDddV pnpm sync-tokens`
- **Acceptance:** New alpha tokens visible in Figma Variables.

---

## Phase 2 — Primitive layer hardening

**Goal:** Close the CVA gap on Input/Select and the showcase gap on form/sonner so the gallery is a complete contract.

### Task 2.1 — Add CVA to `Input`

- **File:** `src/components/ui/input.tsx`.
- **Variants:** `default`, `error` (replace the boolean `error` prop with a typed variant). Optionally add `size: 'sm' | 'default' | 'lg'`.
- **Acceptance:**
  - Existing `<Input error={bool}>` call sites continue to work (back-compat shim, or codemod to `variant="error"`).
  - `src/components/ui/input.tsx` exports `inputVariants` from `cva()`.
  - Internal CSS classes (`input-regular`, `input-border-error`) are no longer referenced by call sites — only by `input.tsx` itself.

### Task 2.2 — Add CVA to `Select`

- **File:** `src/components/ui/select.tsx`.
- **Action:** Move `SelectTrigger` size variants (`sm`, `default`) into a `selectTriggerVariants = cva(...)`. Add `error` variant.
- **Acceptance:** Variant API matches `Input`. Showcase page demonstrates both sizes + error state.

### Task 2.3 — Showcase `form.tsx` and `sonner.tsx`

- **Files:**
  - `src/app/(main)/dev/components/forms/page.tsx` — add a "Form composition" section showing `<Form>` + `<FormField>` + `<FormItem>` + `<FormLabel>` + `<FormControl>` + `<FormMessage>` canonical usage.
  - `src/app/(main)/dev/components/feedback/page.tsx` — add a "Toast provider setup" section showing `<Toaster>` placement and `toast()` calls.
- **Acceptance:** Gallery primitive count reaches 35/35.

---

## Phase 3 — Extract `<DataTable>` primitive

**Goal:** Kill the three-table-system problem. Replace `PipelineTable` (Dashboard custom grid), `PipelinesTable` (Pipelines generic), and `.library-table` (Library) with a single primitive.

### Task 3.1 — Design the API

Read all three implementations first:

- `src/modules/dashboard/components/PipelineTable.tsx` (custom CSS-grid, `COLS = '2fr 2.5fr 1.2fr ...'`)
- `src/components/pipelines/PipelinesTable.tsx` (generic `TableColumn<T>` interface)
- `src/app/styles/library.css` `.library-table` rules + Library list components

Identify the union of features required:

- [ ] Typed columns (`TableColumn<T>` interface)
- [ ] Sticky header row
- [ ] Dense flat rows (no card gap, border-separated)
- [ ] Row hover (`--table-row-bg-hover`)
- [ ] Status-tint rows (critical / warning / healthy backgrounds via row-level prop)
- [ ] Sortable column headers
- [ ] Saved-view / filter integration (Pipelines)
- [ ] Inline sparklines, scope-badges, live-indicators (Dashboard)
- [ ] Click-row navigation
- [ ] Empty state slot (use `<EmptyState>` primitive)
- [ ] Loading state (use `<Skeleton>` primitive)
- [ ] Optional dense mode (`density: 'comfortable' | 'compact'`)

### Task 3.2 — Build `src/components/ui/data-table.tsx`

- Use `cva()` for variants: `density`, `striped` (no — bans zebra striping per `CLAUDE.md` and design principles).
- Consume `--table-*` tokens from `theme.css`.
- Move all CSS for `.table-container`, `.table-row`, sticky-header, hover, row-tints into `src/app/styles/components/table.css` (already exists — extend it).
- Keep `Table` / `TableHeader` / `TableBody` / etc. composable primitives untouched (DataTable composes them internally; advanced consumers can still build custom tables from the lower-level primitives).

### Task 3.3 — Showcase

- Add `/dev/components/display` → "DataTable" section.
- Show: default, with sparkline column, with status-tint rows, with empty state, with loading state, with sortable columns, dense vs comfortable.
- Add canonical code snippet.

### Acceptance criteria

- [ ] `src/components/ui/data-table.tsx` exists, exports typed component.
- [ ] Gallery page documents it.
- [ ] No new lint violations.

---

## Phase 4 — Extract `<PageShell>` scaffolding

**Goal:** Kill the three-page-shell problem. A new feature route should be able to do `<PageShell title="X" breadcrumbs={...}>…</PageShell>` and inherit cohesion for free.

### Task 4.1 — Design the API

Read the three current implementations:

- Dashboard: `<div className="min-h-full flex flex-col">` + `<DashHeader>` (`px-10 pt-7 pb-6`)
- Pipelines: `container mx-auto p-4` + inline toolbar
- Library: `.lib-page` + `.lib-layout` + `.lib-header` (sidebar layout)

Required slots:

- `title` (string)
- `subtitle` (string, optional)
- `breadcrumbs` (uses existing `<Crumbs>` primitive)
- `actions` (right-aligned button slot)
- `filters` (optional toolbar row beneath header)
- `sidebar` (optional left rail — for Library)
- `children` (page body)
- `maxWidth` (default `var(--shell-max-width)` = 1920px)
- `density` (`comfortable` | `compact`)

### Task 4.2 — Build `src/components/shared/page-shell.tsx`

- Compose: `<PageShell>`, `<PageShell.Header>`, `<PageShell.Sidebar>`, `<PageShell.Body>`.
- Consume tokens for max-width, padding (`--unit-x*`), header gap.
- Zero hardcoded px values.
- Bake in the focus ring, the page background (`--color-surface-page`), the shell canvas depth pattern.

### Task 4.3 — Showcase

- Add `/dev/components/shell` (new section in sidebar nav) with three sub-pages or three live examples: "Dashboard layout", "List page layout", "Sidebar layout".
- Each example shows the exact `<PageShell>` API call that produces that layout.

### Acceptance criteria

- [ ] `src/components/shared/page-shell.tsx` exists.
- [ ] Gallery documents it.
- [ ] All three feature surfaces in scope for Phase 6 can be expressed as `<PageShell>` composition.

---

## Phase 5 — Lint enforcement

**Goal:** Make CLAUDE.md §1–§4 enforced by the toolchain, not by convention.

### Task 5.1 — Ban inline hex / rgba in TSX

- **Tool:** Custom ESLint rule or use `eslint-plugin-no-color-literals` / `stylelint`.
- **Scope:** `src/**/*.{ts,tsx}` excluding `src/themes/**` and `src/components/ui/*.figma.tsx`.
- **Patterns banned:**
  - `/#[0-9a-fA-F]{3,8}/` in string literals
  - `/rgba?\(/` in string literals
  - `bg-(red|gray|zinc|blue|green|yellow|orange|purple|...)-\d+` Tailwind utilities for **semantic** colors (allow layout-only utilities like `bg-transparent`, `bg-current`).
- **Allow:** `var(--…)` references inside `bg-[var(--…)]` arbitrary values.

### Task 5.2 — Ban direct use of internal CSS class names

- **Pattern banned in TSX className strings:** `card-dark`, `card-elevated`, `card-outline`, `btn-card`, `btn-primary`, `btn-text`, `input-regular`, `input-border-regular`, `input-border-error`, `modal-input-label`, `modal-input-helper`, `modal-input-error`.
- **Exception:** Allow inside `src/components/ui/**` (primitives consume them internally).
- **State modifiers allowed app-wide:** `card-dark-error`, `card-dark-selected`, `card-outline-error`, `card-outline-selected`, `modal-overlay`, `surface-gradient-border`.

### Task 5.3 — Pre-commit hook

- Add to husky / lefthook config: run the new lint rules on staged files.
- **Acceptance:** Committing a file with a hex value in TSX outside allowed paths fails the hook.

### Task 5.4 — CI gate

- Add the rules to the CI lint step. PRs introducing violations fail check.

---

## Phase 6 — Migrate the three surfaces

**Goal:** Rebuild Dashboard, Pipelines, Library on `<DataTable>` + `<PageShell>`.

> Do one surface at a time, fully, before starting the next. Easier to revert; easier to PR; easier to validate against memory entries.

### Task 6.1 — Migrate Library (least risk — already uses primitives)

- Replace `.lib-page` + `.lib-header` with `<PageShell>` (sidebar slot).
- Replace `.library-table` rules with `<DataTable>` (move row-styling into the primitive; delete `.library-table` from `library.css`).
- Keep `.lib-filter-chip`, `.lib-sort-label`, `.lib-group-label` — they're library-specific, not duplicates.
- **Acceptance:** Visual regression matches current `library-restyle` commit. All Library tests pass.

### Task 6.2 — Migrate Pipelines

- Replace `container mx-auto p-4` + inline toolbar with `<PageShell>` (no sidebar, with filters slot for `<SavedViewsStrip>` + `<PipelineFilterMenu>`).
- Replace `PipelinesTable` with `<DataTable>`. Move `.pipelines-table` rules into the DataTable primitive (or delete if covered by primitive density variants).
- **Acceptance:** Memory notes from `pipelines-table-style` (z-index, gradient borders, save-btn modal clipping) preserved. All Pipeline tests pass.

### Task 6.3 — Migrate Dashboard (highest risk — zero primitive use today)

- Replace custom `<div>` wrapper + `DashHeader` with `<PageShell>`.
- Replace `PipelineTable.tsx` custom CSS-grid with `<DataTable>`, with sparkline column + status-tint rows. The `STATUS_CHIP` dict should be replaced with `<Badge>` variants.
- Replace inline KPI cards, `AttentionQueue`, etc. — leave as-is for now (out of scope, but mark for future review).
- **Acceptance:** Dashboard visual matches `883e47be fix: remove actions column from pp table in dashboard`. All Dashboard tests pass.

---

## Phase 7 — Showcase polish

**Goal:** Make `/dev/components` the contract that prevents future drift.

### Task 7.1 — Composite patterns page

- Add `/dev/components/patterns` with: "Data card" (Card + DataTable), "List with filter rail", "Detail header + tabs", "Empty state inside Card", "Loading skeleton inside DataTable".

### Task 7.2 — Anti-pattern page

- Add `/dev/components/anti-patterns` with crossed-out examples: hardcoded hex, raw `card-dark` className, `bg-red-500` Tailwind utility, gradient text, zebra striping, inline `style={{ color: '#xxx' }}`.

### Task 7.3 — Cmd-K search

- Add a search palette to `GalleryNav` that filters across all variant names, token names, component names.
- Low priority but high payoff once the gallery doubles in size.

---

## Out of scope (intentional)

Not part of this plan, but flagged in the audit for future work:

- KPI card, `AttentionQueue`, `HealthyBanner`, `DashFirstRun` → potential primitives if reused.
- Observability tokens (`--obs-*`) → could be moved into a separate `observability.css` if/when that domain grows.
- `STATUS_CHIP` dict in Dashboard → can be replaced with `<Badge>` once DataTable lands.
- `glassflow-ui-design` skill (`~/.claude/skills/glassflow-ui-design/`) has stale info (claims Inter for body, Archivo for headings — opposite of `CLAUDE.md`). Out of scope here, but worth correcting eventually.

---

## Execution checklist (for future session)

When resuming this plan in a fresh context, this is the minimal set:

```
[x] Phase 1 — Token cleanup (4 tasks)
[ ] Phase 2 — Primitive layer hardening (3 tasks)
[x] Phase 3 — <DataTable> primitive (3 tasks)
[x] Phase 4 — <PageShell> scaffolding (3 tasks)
[x] Phase 5 — Lint enforcement (4 tasks)
[ ] Phase 6 — Migrate three surfaces (3 tasks, do in order)
[ ] Phase 7 — Showcase polish (3 tasks)
```

Mark phases ✅ complete as they ship. Update this doc — it's living.

---

## References

- `docs/DESIGN_SYSTEM_AUDIT_2026-05-12.md` — the why (frozen)
- `docs/GALLERY_AUDIT_2026-05-08.md` — previous gallery-only audit
- `docs/architecture/DESIGN_SYSTEM.md` — token system reference
- `docs/design/DESIGN_WORKFLOW.md` — Figma + Code Connect workflow
- `CLAUDE.md` — non-negotiable styling rules (the rules this plan enforces)
- `src/themes/base.css`, `src/themes/theme.css` — token sources
- `src/components/ui/` — primitive layer
- `src/app/(main)/dev/components/` — showcase
