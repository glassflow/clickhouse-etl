# Full-Width Shell Layout

**Date:** 2026-05-07  
**Branch:** ui-ux-revamp-2.0  
**Status:** Approved

## Problem

The app shell has two visual inconsistencies on screens wider than ~1300px:

1. **Topbar inner content is capped at 1240px** (`--main-container-width`), so the logo, nav links, and right-side actions appear as a narrow centered block inside a full-width bar — disconnected from the page content below.
2. **No consistent max-width for the main content area.** Individual pages handle this differently: `LibraryClient` opts into `max-w-[var(--main-container-width)]`, the dashboard does not, the wizard uses it as a min-width. On very large monitors, pages either grow unbounded or are constrained inconsistently.

## Goal

Make the entire shell — topbar and content — use a single max-width ceiling of **1920px**, centered, with consistent gutters. Below 1920px, both fill available width. The header background continues to span the full viewport (correct for a sticky bar) while its inner content aligns exactly with the page content beneath it.

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Max-width ceiling | `1920px` | Covers full HD monitors; content wider than this becomes uncomfortable for a data tool |
| Token name | `--shell-max-width` | Distinct from `--main-container-width` (1240px, kept for wizard flows) and `--max-content-width` (2560px, unused) |
| Gutters | Keep existing `px-4 sm:px-8 lg:px-10` in `ShellLayoutClient` | Already matches the dashboard; no regressions |
| Topbar padding | Keep existing `px-6` on inner div | Slightly tighter gutter on the bar looks correct at all widths |

## What Does NOT Change

- The header `<header>` element itself remains `w-full` — the background color/border always spans the viewport.
- `--main-container-width: 1240px` is kept for pages that genuinely need a narrow container (pipeline wizard create page uses it as a `min-w`).
- The dashboard's internal CSS classes (`dash-page`, `dash-header`, etc.) are unchanged.
- Mobile/tablet behavior is unchanged — the gutters handle those breakpoints already.

## Files to Change

### 1. `src/app/globals.css`

Add `--shell-max-width: 1920px` to the `:root` layout block (alongside existing layout tokens).

### 2. `src/components/shared/AppTopbar.tsx` — line 185

Change the inner content div from:
```tsx
<div className="flex items-center w-full max-w-[var(--main-container-width)] mx-auto px-6 gap-8 h-full">
```
to:
```tsx
<div className="flex items-center w-full max-w-[var(--shell-max-width)] mx-auto px-6 gap-8 h-full">
```

### 3. `src/components/shared/ShellLayoutClient.tsx` — line 19

Change the content wrapper from:
```tsx
<div className="px-4 sm:px-8 lg:px-10 py-6 min-h-full">
```
to:
```tsx
<div className="px-4 sm:px-8 lg:px-10 py-6 min-h-full max-w-[var(--shell-max-width)] mx-auto w-full">
```

### 4. `src/modules/library/components/LibraryClient.tsx`

Remove the per-component max-width constraint — the shell now owns the ceiling:
```tsx
// Before
<div className="flex flex-col gap-6 animate-fadeIn max-w-[var(--main-container-width)] mx-auto w-full">
// After
<div className="flex flex-col gap-6 animate-fadeIn w-full">
```

## Out of Scope

- Any changes to the `(main)` group layout (Header/HeaderWrapper) — that layout is for non-shell pages (dev components, welcome, notifications settings) and is separate.
- Changing gutter values — the current responsive scale is correct.
- Changing the pipeline wizard create page layout — it uses `--main-container-width` intentionally as a min-width.

## Testing Checklist

- [ ] At 1280px viewport: topbar nav and content are aligned; gutters are visible
- [ ] At 1440px viewport: full-width appearance, no center-pinching on the topbar
- [ ] At 1920px viewport: content stops growing at this breakpoint; equal gutters on both sides
- [ ] At 2560px viewport: 1920px content centered with large equal margins
- [ ] Dashboard, Library, Pipelines list, Pipeline detail: all look consistent
- [ ] Mobile (375px): layout unchanged, gutters correct
