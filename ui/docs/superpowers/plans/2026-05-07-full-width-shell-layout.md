# Full-Width Shell Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1240px-capped topbar and uncapped content area with a single `--shell-max-width: 1920px` ceiling applied consistently to both, so the nav and page content always align.

**Architecture:** One new CSS token is added to `globals.css`. It is applied in two shell-level files (`AppTopbar`, `ShellLayoutClient`). A per-component constraint in `LibraryClient` that duplicated the old narrow cap is removed — the shell now owns this responsibility.

**Tech Stack:** Next.js App Router, Tailwind CSS (JIT arbitrary values), CSS custom properties

---

## File Map

| File | Change |
|---|---|
| `src/app/globals.css` | Add `--shell-max-width: 1920px` to the `:root` layout block |
| `src/components/shared/AppTopbar.tsx` | Line 185: swap `--main-container-width` → `--shell-max-width` on inner content div |
| `src/components/shared/ShellLayoutClient.tsx` | Line 19: add `max-w-[var(--shell-max-width)] mx-auto w-full` to content wrapper div |
| `src/modules/library/components/LibraryClient.tsx` | Line 249: remove `max-w-[var(--main-container-width)] mx-auto` from outer wrapper div |

---

### Task 1: Add token and apply to shell infrastructure

**Files:**
- Modify: `src/app/globals.css:17`
- Modify: `src/components/shared/AppTopbar.tsx:185`
- Modify: `src/components/shared/ShellLayoutClient.tsx:19`

- [ ] **Step 1: Add `--shell-max-width` token to globals.css**

In `src/app/globals.css`, find the `:root` layout block (around line 17) and add the new token after `--main-container-width`:

```css
@layer base {
  :root {
    /* Layout */
    --main-container-width: 1240px;
    --shell-max-width: 1920px;
    --max-content-width: 2560px;
    --hero-container-width: 1024px;
    /* ... rest unchanged */
  }
}
```

- [ ] **Step 2: Update AppTopbar inner content div**

In `src/components/shared/AppTopbar.tsx`, find line 185 and change:

```tsx
// Before
<div className="flex items-center w-full max-w-[var(--main-container-width)] mx-auto px-6 gap-8 h-full">

// After
<div className="flex items-center w-full max-w-[var(--shell-max-width)] mx-auto px-6 gap-8 h-full">
```

- [ ] **Step 3: Update ShellLayoutClient content wrapper**

In `src/components/shared/ShellLayoutClient.tsx`, find line 19 and change:

```tsx
// Before
<div className="px-4 sm:px-8 lg:px-10 py-6 min-h-full">

// After
<div className="px-4 sm:px-8 lg:px-10 py-6 min-h-full max-w-[var(--shell-max-width)] mx-auto w-full">
```

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/shared/AppTopbar.tsx src/components/shared/ShellLayoutClient.tsx
git commit -m "feat: add --shell-max-width token and apply to topbar and shell content"
```

---

### Task 2: Remove per-component max-width from LibraryClient

The shell now owns the 1920px ceiling. LibraryClient's own `max-w-[var(--main-container-width)]` (1240px) is no longer needed and would constrain the library to a narrower width than the rest of the app.

**Files:**
- Modify: `src/modules/library/components/LibraryClient.tsx:249`

- [ ] **Step 1: Remove the constraint from the outer wrapper**

In `src/modules/library/components/LibraryClient.tsx`, find line 249 and change:

```tsx
// Before
<div className="flex flex-col gap-6 animate-fadeIn max-w-[var(--main-container-width)] mx-auto w-full">

// After
<div className="flex flex-col gap-6 animate-fadeIn w-full">
```

- [ ] **Step 2: Run the existing test suite**

```bash
pnpm test
```

Expected: all tests pass. The library test files (`ConnectionDetail.test.tsx`, `SchemaDetail.test.tsx`, `SchemaList.test.tsx`, `DedupConfigDetail.test.tsx`, etc.) do not assert on className values, so no test changes are needed.

- [ ] **Step 3: Commit**

```bash
git add src/modules/library/components/LibraryClient.tsx
git commit -m "feat: remove per-component max-width from LibraryClient, shell now owns ceiling"
```

---

## Visual Verification Checklist

After both tasks are committed, start the dev server (`pnpm dev`) and verify:

- [ ] At **1280px** viewport: topbar nav content and page content are left-aligned with the same gutter
- [ ] At **1440px** viewport: everything is full-width; topbar no longer has a narrow centered block
- [ ] At **1920px** viewport: content fills the full width; both topbar and content reach the edges together
- [ ] At **2560px** viewport: content stops at 1920px, centered with equal margins on both sides; topbar content also centered at 1920px
- [ ] **Dashboard** route: unchanged appearance
- [ ] **Library** route: header/list/detail panels all flush with the shell gutter, not narrower than dashboard
- [ ] **Pipelines list** route: consistent with dashboard width
- [ ] **Mobile (375px)**: gutters unchanged, no layout breakage
