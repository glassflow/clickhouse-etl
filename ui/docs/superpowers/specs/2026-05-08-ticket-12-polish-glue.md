# Ticket 12 — Polish & Glue: Token Audit + Verification Pass

**Date:** 2026-05-08
**Branch:** `ui-ux-revamp-2.0`
**Scope:** Fix all hardcoded color violations across the branch, add an ESLint rule to prevent regression, and do a quick read-and-confirm verification of all major product surfaces.

---

## Context

Ticket 12 is the final phase of the UI Revamp 2026 epic. A pre-implementation audit confirmed that most deliverables (DLQViewer, NotificationChannelConfig, cross-phase navigation, wizard modules, home page creation paths) are already wired. The remaining actionable work is:

1. Fix hardcoded `rgba()`/hex color violations in all branch-touched files
2. Add an ESLint rule to prevent new violations
3. Verification pass: read-and-confirm that key surfaces are correctly wired

---

## Gap 1: Token Audit + Fix

### Scope

All files changed on this branch (`git diff main...HEAD --name-only`) plus any UI primitives touched in the revamp (`button.tsx`, `drawer.tsx`, `time-range-picker.tsx`). CSS files where tokens are defined (`base.css`, `theme.css`) are excluded.

Violation patterns to flag and fix:
- Bare hex values: `#[0-9a-fA-F]{3,6}` in `.tsx`/`.ts` files
- `rgba(...)` or `rgb(...)` in `.tsx`/`.ts` files
- Raw Tailwind color utilities: `bg-red-*`, `text-gray-*`, `border-zinc-*`, etc.

Known violations from audit:
| File | Violation |
|---|---|
| `src/modules/pipelines/components/PipelineTagsModal.tsx` | `rgba(17, 25, 40, 0.25)`, `rgba(255, 255, 255, 0.125)` |
| `src/modules/review/EditorWrapper.tsx` | `#333` border |
| `src/components/ui/drawer.tsx` | `rgba(0,0,0,0.45)` in shadow |
| `src/components/ui/button.tsx` | Multiple `rgba()` in shadow utilities |
| `src/components/ui/time-range-picker.tsx` | Unconfirmed — needs audit |

### Fix strategy

Map each violation to an existing CSS token. If no token fits, add a new one:

1. Add the primitive value to `src/themes/base.css` (`:root` block)
2. Add the semantic reference to `src/themes/theme.css` (`:root, [data-theme='dark']` block)
3. Use `var(--your-new-token)` in the component

Token mapping guide:
| Violation | Token target |
|---|---|
| `rgba(17, 25, 40, 0.25)` overlay backgrounds | `var(--overlay-bg)` |
| `rgba(255, 255, 255, 0.125)` subtle highlights | `var(--surface-raised)` or new `--color-white-alpha-10` |
| `#333` borders | `var(--surface-border)` |
| Shadow `rgba(0,0,0,...)` in UI primitives | `var(--shadow-md)` / `var(--shadow-sm)` or new `--shadow-*` token |

After all fixes, run `pnpm sync-tokens` to push new tokens to Figma Variables.

---

## Gap 2: ESLint Regression Guard

Add a `no-restricted-syntax` rule to the project ESLint config to ban hardcoded color patterns in TypeScript/JSX files.

Rule targets (as AST selector strings or regex-based linting):
- `rgba(` appearing in JSX attribute string values or template literals in `.tsx`/`.ts` files
- `style` prop object values containing string literals that match `#[0-9a-fA-F]{3,6}`

The rule config goes in `eslint.config.mjs` (or `.eslintrc.*`, whichever the project uses). CSS files (`*.css`) are excluded from the rule — `base.css` and `theme.css` are where raw values belong.

The rule reports an error (not warning) so CI catches violations.

---

## Gap 3: Verification Pass

Read-and-confirm audit of six surfaces. Any gap found gets a minimal fix (broken import, missing prop) or is filed as a follow-up if it requires a full feature build.

| Surface | Checkpoint |
|---|---|
| Home page | All 3 creation paths (Wizard / Canvas / AI) reachable and wired |
| Wizard | `/pipelines/create` route exists, all 7 step modules importable, no broken imports |
| Pipeline detail | Tabs (Overview / Canvas / Library / Metrics / Logs / Settings) present; breadcrumbs render via `Crumbs` component |
| Canvas | `initDefaultPipeline('kafka')` fires when no `?draft=` param — blank canvas never shown |
| DLQViewer | Imported and rendered in observability route, not a dead import |
| NotificationChannelConfig | Imported and rendered in observability route |

---

## Invariants

- No new product features — only quality fixes and wiring verification
- `rgba()`/hex values survive only in `base.css` and `theme.css`
- ESLint rule is an error (not warning) — CI-enforced
- `pnpm sync-tokens` runs after any new token additions
- Verification gaps that require full feature work are filed as follow-up tickets, not fixed inline

---

## File Map

| File | Change |
|---|---|
| `src/modules/pipelines/components/PipelineTagsModal.tsx` | Replace rgba() with tokens |
| `src/modules/review/EditorWrapper.tsx` | Replace #333 with token |
| `src/components/ui/drawer.tsx` | Replace rgba() shadow with token |
| `src/components/ui/button.tsx` | Replace rgba() shadows with tokens |
| `src/components/ui/time-range-picker.tsx` | Audit + fix if violations present |
| `src/themes/base.css` | Add new primitive tokens if needed |
| `src/themes/theme.css` | Add new semantic token references if needed |
| `eslint.config.mjs` (or equivalent) | Add no-restricted-syntax rule for hardcoded colors |
| Any other branch-touched file with violations | Fix inline |
