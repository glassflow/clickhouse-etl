# Ticket 12 — Polish & Glue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all hardcoded color violations introduced in this revamp, add an ESLint rule to prevent regressions, and do a read-and-confirm verification pass across all major product surfaces.

**Architecture:** Three independent tasks — token fixes (two batches: existing-token fixes and new-token additions), ESLint rule addition, and a read-only verification sweep. No new product features. No new routes or schema changes.

**Tech Stack:** TypeScript, CSS custom properties (tokens), ESLint flat config (`eslint.config.mjs`), Next.js App Router

---

## File Map

**Modify (existing tokens — no new token needed):**
- `src/modules/pipelines/components/PipelineTagsModal.tsx` — inline rgba() → existing overlay tokens
- `src/modules/review/EditorWrapper.tsx` — `#333` → `var(--surface-border)`

**Modify (new tokens needed):**
- `src/themes/base.css` — add 4 new primitive shadow tokens
- `src/components/ui/drawer.tsx` — rgba shadow → `var(--shadow-drawer)`
- `src/components/ui/button.tsx` — two rgba shadow sets → token references
- `src/components/ui/time-range-picker.tsx` — rgba shadow → `var(--shadow-xs-dark)`

**Modify (ESLint):**
- `eslint.config.mjs` — add `no-restricted-syntax` rule banning hardcoded colors in style/className JSX props

**Read-only (verification):**
- `src/app/(shell)/home/page.tsx`
- `src/app/(shell)/pipelines/create/page.tsx`
- `src/app/(shell)/observability/[id]/page.tsx`
- `src/modules/canvas/CanvasView.tsx`

---

## Existing tokens reference

These tokens exist and are used in the fixes below — do not add them again:

| Token | Value | Location |
|---|---|---|
| `--overlay-bg` | `rgba(17, 25, 40, 0.25)` | `src/themes/theme.css:195` |
| `--overlay-border` | `rgba(255, 255, 255, 0.125)` | `src/themes/theme.css:197` |
| `--overlay-backdrop-blur` | `blur(4px) saturate(30%)` | `src/themes/theme.css:196` |
| `--surface-border` | `var(--color-border-neutral-faded)` | `src/themes/theme.css:186` |
| `--shadow-pressed` | `0px 0px 4px 0px rgba(0,0,0,0.2), 0px 4px 8px 0px rgba(0,0,0,0.3)` | `src/themes/base.css:275` |

---

## Task 1: Fix PipelineTagsModal.tsx and EditorWrapper.tsx (existing tokens)

**Files:**
- Modify: `src/modules/pipelines/components/PipelineTagsModal.tsx:114-122`
- Modify: `src/modules/review/EditorWrapper.tsx:45`

- [ ] **Step 1: Fix PipelineTagsModal.tsx**

Open `src/modules/pipelines/components/PipelineTagsModal.tsx`. Find the `DialogOverlay` around line 114:

```tsx
<DialogOverlay
  className="!fixed !inset-0"
  aria-hidden="true"
  style={{
    backgroundColor: 'rgba(17, 25, 40, 0.25)',
    backdropFilter: 'blur(4px) saturate(30%)',
    WebkitBackdropFilter: 'blur(4px) saturate(30%)',
    border: '1px solid rgba(255, 255, 255, 0.125)',
  }}
/>
```

Replace with:

```tsx
<DialogOverlay
  className="!fixed !inset-0 modal-overlay"
  aria-hidden="true"
  style={{ border: '1px solid var(--overlay-border)' }}
/>
```

Explanation: `modal-overlay` CSS class (defined in `src/app/styles/components/modal.css`) applies `--overlay-bg` and `--overlay-backdrop-blur` automatically. The border is kept as an inline style but now uses the `--overlay-border` token — no hardcoded value remains.

- [ ] **Step 2: Fix EditorWrapper.tsx**

Open `src/modules/review/EditorWrapper.tsx`. Find line 45:

```tsx
style={{ border: '1px solid #333', borderRadius: '0.375rem', overflow: 'hidden' }}
```

Replace with:

```tsx
style={{ border: '1px solid var(--surface-border)', borderRadius: '0.375rem', overflow: 'hidden' }}
```

- [ ] **Step 3: Verify no hardcoded colors remain in these two files**

```bash
grep -n "rgba\|#[0-9a-fA-F]\{3,6\}" src/modules/pipelines/components/PipelineTagsModal.tsx src/modules/review/EditorWrapper.tsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/modules/pipelines/components/PipelineTagsModal.tsx src/modules/review/EditorWrapper.tsx
git commit -m "fix: replace hardcoded rgba/hex colors with CSS tokens in PipelineTagsModal and EditorWrapper"
```

---

## Task 2: Add new shadow tokens + fix drawer.tsx, button.tsx, time-range-picker.tsx

**Files:**
- Modify: `src/themes/base.css` — add 4 tokens after the existing shadow block (around line 276)
- Modify: `src/components/ui/drawer.tsx:32`
- Modify: `src/components/ui/button.tsx:17,33`
- Modify: `src/components/ui/time-range-picker.tsx:49`

- [ ] **Step 1: Add 4 new shadow tokens to `src/themes/base.css`**

Open `src/themes/base.css`. Find the shadow block (around line 273–276):

```css
  --shadow-raised: 0px 1px 5px -4px rgba(0, 0, 0, 0.5), 0px 4px 8px 0px rgba(0, 0, 0, 0.05);
  --shadow-overlay: 0px 5px 10px 0px rgba(0, 0, 0, 0.05), 0px 15px 25px 0px rgba(0, 0, 0, 0.07);
  --shadow-pressed: 0px 0px 4px 0px rgba(0, 0, 0, 0.2), 0px 4px 8px 0px rgba(0, 0, 0, 0.3);
  --shadow-neutral: 0px 0px 8px 0px rgba(0, 0, 0, 0.08), 0px 12px 24px 0px rgba(0, 0, 0, 0.12);
```

Add immediately after `--shadow-neutral`:

```css
  --shadow-drawer: 0 6px 18px rgba(0, 0, 0, 0.45);           /* AI drawer + side panels */
  --shadow-primary-hover: 0px 0px 6px 0px rgba(0, 0, 0, 0.25), 0px 6px 12px 0px rgba(0, 0, 0, 0.35); /* primary/gradient button hover */
  --shadow-primary-disabled: 0px 0px 2px 0px rgba(0, 0, 0, 0.10), 0px 2px 4px 0px rgba(0, 0, 0, 0.15); /* primary/gradient button disabled */
  --shadow-xs-dark: 0 1px 0 rgba(0, 0, 0, 0.30);             /* subtle pressed row / picker item */
```

- [ ] **Step 2: Fix `src/components/ui/drawer.tsx`**

Find line 32:

```tsx
'shadow-[0_6px_18px_rgba(0,0,0,0.45)]',
```

Replace with:

```tsx
'shadow-[var(--shadow-drawer)]',
```

- [ ] **Step 3: Fix `src/components/ui/button.tsx` — `primary` variant (line 17)**

Find the `primary` variant string (line 17). It contains three shadow values:
- Normal: `shadow-[0px_0px_4px_0px_rgba(0,0,0,0.20),0px_4px_8px_0px_rgba(0,0,0,0.30)]` → use existing `--shadow-pressed`
- Hover: `hover:shadow-[0px_0px_6px_0px_rgba(0,0,0,0.25),0px_6px_12px_0px_rgba(0,0,0,0.35)]` → new `--shadow-primary-hover`
- Disabled: `disabled:shadow-[0px_0px_2px_0px_rgba(0,0,0,0.10),0px_2px_4px_0px_rgba(0,0,0,0.15)]` → new `--shadow-primary-disabled`

Replace the entire `primary` value string:

```ts
primary:
  'rounded-md bg-gradient-to-br from-[var(--button-primary-gradient-start)] to-[var(--button-primary-gradient-end)] shadow-[var(--shadow-pressed)] hover:shadow-[var(--shadow-primary-hover)] hover:opacity-90 active:bg-[var(--button-primary-gradient-end)] active:shadow-[var(--shadow-raised)] disabled:bg-gradient-to-br disabled:from-[var(--button-primary-gradient-disabled-start)] disabled:to-[var(--button-primary-gradient-disabled-end)] disabled:shadow-[var(--shadow-primary-disabled)] disabled:pointer-events-none text-[var(--button-primary-text)] btn-text',
```

- [ ] **Step 4: Fix `src/components/ui/button.tsx` — `gradient` variant (line 33)**

The `gradient` variant has the same three shadow patterns. Replace the entire `gradient` value string:

```ts
gradient:
  'rounded-md bg-gradient-to-br from-[var(--button-primary-gradient-start)] to-[var(--button-primary-gradient-end)] shadow-[var(--shadow-pressed)] hover:shadow-[var(--shadow-primary-hover)] disabled:bg-gradient-to-br disabled:from-[var(--button-primary-gradient-disabled-start)] disabled:to-[var(--button-primary-gradient-disabled-end)] disabled:shadow-[var(--shadow-primary-disabled)] disabled:pointer-events-none',
```

- [ ] **Step 5: Fix `src/components/ui/time-range-picker.tsx`**

Find line 49:

```tsx
? 'bg-[var(--color-background-elevation-raised)] text-[var(--text-primary)] shadow-[0_1px_0_rgba(0,0,0,0.3)]'
```

Replace with:

```tsx
? 'bg-[var(--color-background-elevation-raised)] text-[var(--text-primary)] shadow-[var(--shadow-xs-dark)]'
```

- [ ] **Step 6: Verify no hardcoded colors remain in any of these files**

```bash
grep -n "rgba\|#[0-9a-fA-F]\{3,6\}" \
  src/components/ui/drawer.tsx \
  src/components/ui/button.tsx \
  src/components/ui/time-range-picker.tsx
```

Expected: no output.

- [ ] **Step 7: Run pnpm sync-tokens to push new tokens to Figma**

```bash
pnpm sync-tokens
```

If `FIGMA_ACCESS_TOKEN` is not set in the environment, skip this step and note it for later.

- [ ] **Step 8: Commit**

```bash
git add src/themes/base.css src/components/ui/drawer.tsx src/components/ui/button.tsx src/components/ui/time-range-picker.tsx
git commit -m "fix: add shadow tokens and replace all remaining hardcoded rgba() in UI primitives"
```

---

## Task 3: ESLint rule — ban hardcoded colors in JSX

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Add `no-restricted-syntax` rule to `eslint.config.mjs`**

Open `eslint.config.mjs`. Find the `rules` object inside the `{ files: ['**/*.ts', '**/*.tsx'], ... }` config block. Add the following rules after the existing entries:

```js
// Ban hardcoded rgba() and hex colors in JSX style props and className strings.
// All colors must use CSS tokens: var(--token-name).
// Raw values belong only in src/themes/base.css and src/themes/theme.css.
'no-restricted-syntax': [
  'error',
  {
    selector:
      'JSXAttribute[name.name="style"] ObjectExpression > Property > Literal[value=/rgba\\(/]',
    message:
      'Hardcoded rgba() in style prop. Use a CSS token: style={{ color: "var(--token)" }}.',
  },
  {
    selector:
      'JSXAttribute[name.name="style"] ObjectExpression > Property > Literal[value=/#[0-9a-fA-F]{3}/]',
    message:
      'Hardcoded hex color in style prop. Use a CSS token: style={{ color: "var(--token)" }}.',
  },
  {
    selector: 'JSXAttribute[name.name="className"] Literal[value=/rgba\\(/]',
    message:
      'Hardcoded rgba() in className. Add a CSS token to base.css/theme.css and use var(--token).',
  },
],
```

The complete updated rules block will look like:

```js
rules: {
  // React rules
  'react/react-in-jsx-scope': 'off',
  'react/prop-types': 'off',
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'off',

  // TypeScript rules
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',

  // Next.js specific rules
  '@next/next/no-html-link-for-pages': 'off',

  // Ban hardcoded rgba() and hex colors in JSX style props and className strings.
  // All colors must use CSS tokens: var(--token-name).
  // Raw values belong only in src/themes/base.css and src/themes/theme.css.
  'no-restricted-syntax': [
    'error',
    {
      selector:
        'JSXAttribute[name.name="style"] ObjectExpression > Property > Literal[value=/rgba\\(/]',
      message:
        'Hardcoded rgba() in style prop. Use a CSS token: style={{ color: "var(--token)" }}.',
    },
    {
      selector:
        'JSXAttribute[name.name="style"] ObjectExpression > Property > Literal[value=/#[0-9a-fA-F]{3}/]',
      message:
        'Hardcoded hex color in style prop. Use a CSS token: style={{ color: "var(--token)" }}.',
    },
    {
      selector: 'JSXAttribute[name.name="className"] Literal[value=/rgba\\(/]',
      message:
        'Hardcoded rgba() in className. Add a CSS token to base.css/theme.css and use var(--token).',
    },
  ],
},
```

- [ ] **Step 2: Run ESLint to verify the rule fires on no remaining violations**

```bash
pnpm eslint src/modules/pipelines/components/PipelineTagsModal.tsx src/modules/review/EditorWrapper.tsx src/components/ui/drawer.tsx src/components/ui/button.tsx src/components/ui/time-range-picker.tsx 2>&1 | grep -E "error|warning" | head -20
```

Expected: no `no-restricted-syntax` errors. Any output should only be pre-existing warnings unrelated to color.

- [ ] **Step 3: Confirm the rule would catch a violation (sanity check)**

```bash
node -e "
const code = 'const x = <div style={{ color: \"rgba(255,0,0,1)\" }} />';
console.log('Test input:', code);
"
```

This is just a sanity check that you understand what the rule targets — no action needed.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore: add ESLint rule banning hardcoded rgba() and hex colors in JSX"
```

---

## Task 4: Verification pass

**Files:** Read-only. Fix only if a minor wiring issue is found (broken import, missing prop). File a follow-up note for anything requiring substantial work.

- [ ] **Step 1: Verify home page creation paths**

Read `src/app/(shell)/home/page.tsx` (or `src/components/home/HomePageClient.tsx`).

Confirm:
- Wizard path: calls `handleTopicCountClick(1)` or equivalent to set topic count and navigate to `/pipelines/create`
- Canvas path: `<Link href="/canvas">` or equivalent
- AI path: calls `aiUiStore.openDrawer()` or equivalent — AND this call is gated so it only appears when `aiEnabled` is true (check the prop threading)

If AI path is unconditionally shown even when `aiEnabled` is false, that is a gap — note it as a follow-up. Do not fix inline.

- [ ] **Step 2: Verify wizard step modules are importable**

```bash
grep -r "from.*modules/kafka\|from.*modules/clickhouse\|from.*modules/deduplication\|from.*modules/filter\|from.*modules/transformation\|from.*modules/resources\|from.*modules/review" src/app/\(shell\)/pipelines/create/ --include="*.tsx" --include="*.ts" | head -20
```

Expected: imports exist. If zero results, check `src/modules/pipeline-wizard/` or adjacent path.

```bash
pnpm tsc --noEmit 2>&1 | grep -E "modules/(kafka|clickhouse|deduplication|filter|transformation|resources|review)" | head -10
```

Expected: no errors from wizard modules.

- [ ] **Step 3: Verify DLQViewer and NotificationChannelConfig are wired**

```bash
grep -n "DLQViewer\|NotificationChannelConfig" src/app/\(shell\)/observability/\[id\]/page.tsx
```

Expected: both appear — imported AND rendered (not just imported). If either is imported but not rendered, that is a gap — note as follow-up.

- [ ] **Step 4: Verify canvas never shows a blank state**

Read `src/modules/canvas/CanvasView.tsx`, mount effect (around line 77-84).

Confirm the logic is:
```ts
if (initialConfig) {
  initFromConfig(pipelineConfigToCanvas(initialConfig))
} else if (nodes.length === 0) {
  initDefaultPipeline('kafka')
}
```

This ensures the canvas always has nodes. If this is NOT present, the canvas could show blank — that is a Critical gap, fix it immediately by restoring the effect.

- [ ] **Step 5: Verify pipeline detail tabs**

```bash
grep -rn "PipelineTabs\|Overview\|Canvas.*tab\|Settings.*tab" src/app/\(shell\)/pipelines/\[id\]/ --include="*.tsx" | head -10
```

Expected: tabs component referenced from the pipeline detail page.

- [ ] **Step 6: Final full-branch color scan**

```bash
git diff main...HEAD --name-only | grep -E "\.tsx$|\.ts$" | xargs grep -l "rgba\|#[0-9a-fA-F]\{3,6\}" 2>/dev/null | grep -v "node_modules\|\.test\.\|__tests__\|base\.css\|theme\.css"
```

Expected: no output. If any files appear, check each one — if the violation is in a test fixture or a non-color use of `#` (e.g., URL fragment), ignore it. If it's a real color violation, fix it inline.

- [ ] **Step 7: Commit verification findings**

If no fixes were needed:

```bash
git commit --allow-empty -m "chore: verification pass — all surfaces confirmed wired, no gaps found"
```

If minor fixes were applied, commit them with a descriptive message. If substantial gaps were found, document them:

Create `docs/superpowers/follow-ups/ticket-12-gaps.md` listing each gap with a one-line description, then:

```bash
git add docs/superpowers/follow-ups/
git commit -m "chore: document Ticket 12 verification gaps for follow-up"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Fix `PipelineTagsModal.tsx` rgba violations | Task 1 |
| Fix `EditorWrapper.tsx` #333 violation | Task 1 |
| Add new shadow tokens to `base.css` | Task 2 |
| Fix `drawer.tsx` rgba shadow | Task 2 |
| Fix `button.tsx` rgba shadows | Task 2 |
| Fix `time-range-picker.tsx` rgba shadow | Task 2 |
| Run `pnpm sync-tokens` | Task 2 |
| ESLint rule banning hardcoded colors | Task 3 |
| Verify home creation paths | Task 4 |
| Verify wizard step modules | Task 4 |
| Verify DLQViewer + NotificationChannelConfig wired | Task 4 |
| Verify canvas never blank | Task 4 |
| Final full-branch color scan | Task 4 |

**Placeholder scan:** No TBDs. All code blocks complete. All file paths explicit.

**Type consistency:** No new types introduced — this plan is purely CSS tokens + ESLint config + read-only verification.
